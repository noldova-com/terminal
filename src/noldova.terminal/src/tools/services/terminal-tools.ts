/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleLog, IToolsContext, Registration } from "@noldova/desktop.runtime";

import type { IDisposable } from "../../interfaces/i-disposable.ts";
import { Resources } from "../../resources.ts";
import type { IAgentTerminal } from "../interfaces/i-agent-terminal.ts";
import type { IAgentTerminals } from "../interfaces/i-agent-terminals.ts";
import { ReadCursors } from "../models/read-cursors.ts";
import { PermissionGate } from "./permission-gate.ts";
import { TerminalAccessPolicy } from "./terminal-access-policy.ts";
import { TerminalCloseTool } from "./terminal-close-tool.ts";
import { TerminalInterruptTool } from "./terminal-interrupt-tool.ts";
import { TerminalListTool } from "./terminal-list-tool.ts";
import { TerminalOpenTool } from "./terminal-open-tool.ts";
import { TerminalReadTool } from "./terminal-read-tool.ts";
import { TerminalRunTool } from "./terminal-run-tool.ts";
import type { TerminalTool } from "./terminal-tool.ts";
import { TerminalWriteTool } from "./terminal-write-tool.ts";

export class TerminalTools implements IDisposable {
  private readonly accessPolicy: TerminalAccessPolicy;
  private readonly terminals: IAgentTerminals;
  private readonly cursors: ReadCursors = new ReadCursors();
  private readonly registrations: Registration[] = [];

  public readonly tools: readonly TerminalTool<unknown>[];

  public constructor(terminals: IAgentTerminals) {
    const accessPolicy: TerminalAccessPolicy = new TerminalAccessPolicy(terminals);
    const gate: PermissionGate = new PermissionGate();

    this.accessPolicy = accessPolicy;
    this.terminals = terminals;
    this.tools = [
      new TerminalListTool(accessPolicy),
      new TerminalReadTool(accessPolicy, gate, this.cursors),
      new TerminalOpenTool(terminals, gate),
      new TerminalRunTool(accessPolicy, gate, this.cursors),
      new TerminalWriteTool(accessPolicy, gate),
      new TerminalInterruptTool(accessPolicy, gate),
      new TerminalCloseTool(accessPolicy, gate, this.cursors)
    ];
  }

  public get toolNames(): readonly string[] {
    return this.tools.map(t => t.descriptor.name);
  }

  public publish(tools: IToolsContext, log: IModuleLog): void {
    for (const tool of this.tools)
      this.registrations.push(tools.register(tool.descriptor, tool));
    this.registrations.push(tools.onSessionEnded(t => void this.endSessionAsync(t).catch((error: unknown) =>
      log.write(Resources.formatSessionEndFailed(t, error instanceof Error ? error.message : String(error))))));
  }

  public dispose(): void {
    for (const registration of this.registrations.splice(0))
      registration[Symbol.dispose]();
  }

  private async endSessionAsync(agentSessionId: string): Promise<void> {
    const owned: readonly IAgentTerminal[] = this.accessPolicy.listClosingWith(agentSessionId);
    this.cursors.forgetSession(agentSessionId);
    this.terminals.endSession(agentSessionId);
    await Promise.all(owned.map(t => t.closeAsync()));
    for (const terminal of owned)
      this.cursors.forgetTerminal(terminal.id);
  }
}
