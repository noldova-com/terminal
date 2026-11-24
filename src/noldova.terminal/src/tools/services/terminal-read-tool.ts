/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IToolDescriptor, type ToolResult, ToolRisk } from "@noldova/desktop.runtime";

import { Resources } from "../../resources.ts";
import type { AgentTerminalAccess } from "../models/agent-terminal-access.ts";
import type { OutputChunk } from "../models/output-chunk.ts";
import { OutputExcerpt } from "../models/output-excerpt.ts";
import { PermissionAsk } from "../models/permission-ask.ts";
import { ReadCursor } from "../models/read-cursor.ts";
import type { ReadCursors } from "../models/read-cursors.ts";
import { TerminalOutputReport } from "../models/terminal-output-report.ts";
import { TerminalReadInput } from "../models/terminal-read-input.ts";
import type { ToolCallContext } from "../models/tool-call-context.ts";
import { PermissionDetails } from "./permission-details.ts";
import type { PermissionGate } from "./permission-gate.ts";
import type { TerminalAccessPolicy } from "./terminal-access-policy.ts";
import { TerminalTool } from "./terminal-tool.ts";

export class TerminalReadTool extends TerminalTool<TerminalReadInput> {
  private readonly accessPolicy: TerminalAccessPolicy;
  private readonly gate: PermissionGate;
  private readonly cursors: ReadCursors;

  public readonly descriptor: IToolDescriptor = {
    name: Resources.readToolName,
    description: Resources.readToolDescription,
    inputSchema: TerminalReadInput.schema,
    outputSchema: TerminalOutputReport.outputSchema,
    hints: { isReadOnly: true, isDestructive: false, isOpenWorld: false },
    risk: { default: ToolRisk.Low, maximum: ToolRisk.Medium },
    isResumable: true,
    marksSending: false,
    deadline: { default: Resources.shortCallMilliseconds, maximum: Resources.maximumCallMilliseconds }
  };

  public constructor(accessPolicy: TerminalAccessPolicy, gate: PermissionGate, cursors: ReadCursors) {
    super();

    this.accessPolicy = accessPolicy;
    this.gate = gate;
    this.cursors = cursors;
  }

  protected parseInput(input: unknown): TerminalReadInput {
    return TerminalReadInput.fromJson(input);
  }

  protected async runAsync(input: TerminalReadInput, context: ToolCallContext): Promise<ToolResult> {
    const access: AgentTerminalAccess = this.accessPolicy.resolve(input.terminalId, context);
    await this.gate.requireGrantAsync(TerminalReadTool.askFor(access), context);
    this.accessPolicy.requireStill(access, context);
    const cursor: ReadCursor = this.cursors.find(context.agentSessionId, input.terminalId) ?? ReadCursor.forTerminal(access.terminal, 0);
    await cursor.source.waitForOutputAsync(cursor.offset, input.waitMilliseconds, context.signal);
    const chunk: OutputChunk = cursor.source.readSince(cursor.offset);
    const cwd: string | null = cursor.command === null ? access.terminal.readPrompt().cwd : cursor.command.cwd;
    const report: TerminalOutputReport = new TerminalOutputReport(access, cursor.command, OutputExcerpt.of(chunk, input.maximumCharacters), cwd);
    if (context.signal.aborted)
      throw TerminalTool.failEndedCall(Resources.readToolName, cursor.command, report, context.signal);
    this.cursors.set(context.agentSessionId, input.terminalId, cursor.advancedTo(chunk.endOffset));
    return report.toResult();
  }

  private static askFor(access: AgentTerminalAccess): PermissionAsk {
    return new PermissionAsk(
      Resources.readToolName,
      Resources.readAction,
      Resources.readTitle,
      access.isShared ? ToolRisk.Medium : ToolRisk.Low,
      PermissionDetails.forTerminal(access),
      PermissionAsk.listSubject([access.terminal.id]));
  }
}
