/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleLog } from "@noldova/desktop.runtime";
import { Resources as ProtocolResources, TerminalSize } from "@noldova/terminal.protocol";

import type { IFileSystemWriter } from "../interfaces/i-file-system-writer.ts";
import type { HostedTerminal } from "../models/hosted-terminal.ts";
import { Resources } from "../resources.ts";
import type { IAgentTerminal } from "../tools/interfaces/i-agent-terminal.ts";
import type { IAgentTerminals } from "../tools/interfaces/i-agent-terminals.ts";
import type { AgentTerminalOpening } from "../tools/models/agent-terminal-opening.ts";
import { AgentTerminal } from "./agent-terminal.ts";
import type { TerminalHost } from "./terminal-host.ts";

export class AgentTerminals implements IAgentTerminals {
  private readonly host: TerminalHost;
  private readonly writer: IFileSystemWriter;
  private readonly logFolder: string;
  private readonly log: IModuleLog;
  private readonly terminals: Map<string, AgentTerminal> = new Map<string, AgentTerminal>();

  public constructor(host: TerminalHost, writer: IFileSystemWriter, logFolder: string, log: IModuleLog) {
    this.host = host;
    this.writer = writer;
    this.logFolder = logFolder;
    this.log = log;
  }

  public list(): readonly IAgentTerminal[] {
    const hosted: readonly HostedTerminal[] = this.host.terminals;
    for (const id of this.terminals.keys()) {
      if (!hosted.some(t => t.session.sessionId === id))
        this.terminals.delete(id);
    }
    return hosted.map(t => this.wrap(t));
  }

  public find(id: string): IAgentTerminal | undefined {
    const hosted: HostedTerminal | undefined = this.host.findTerminal(id);
    return hosted === undefined ? undefined : this.wrap(hosted);
  }

  public async openAsync(opening: AgentTerminalOpening, signal: AbortSignal): Promise<IAgentTerminal> {
    const size: TerminalSize = new TerminalSize(Resources.agentColumns, Resources.agentRows);
    const terminal: AgentTerminal = this.wrap(await this.host.openTerminalAsync(opening.shellId, opening.cwd, size, opening.ownerSessionId,
      ProtocolResources.defaultStoredLimit, null, false,
      this.host.findAgentSessionOwner(opening.ownerSessionId) ?? opening.owner));
    await terminal.waitForIntegrationAsync(signal);
    return terminal;
  }

  public findSessionOwner(agentSessionId: string): string | null {
    return this.host.findAgentSessionOwner(agentSessionId);
  }

  public endSession(agentSessionId: string): void {
    this.host.unbindAgentSession(agentSessionId);
  }

  private wrap(hosted: HostedTerminal): AgentTerminal {
    let terminal: AgentTerminal | undefined = this.terminals.get(hosted.session.sessionId);
    if (terminal === undefined) {
      terminal = new AgentTerminal(hosted, this.host, this.writer, this.logFolder, this.log);
      this.terminals.set(hosted.session.sessionId, terminal);
    }
    return terminal;
  }
}
