/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ToolFailureCode } from "@noldova/desktop.runtime";

import { Resources } from "../../resources.ts";
import type { IAgentTerminal } from "../interfaces/i-agent-terminal.ts";
import type { IAgentTerminals } from "../interfaces/i-agent-terminals.ts";
import { AgentTerminalAccess } from "../models/agent-terminal-access.ts";
import type { ToolCallContext } from "../models/tool-call-context.ts";
import { ToolFailures } from "./tool-failures.ts";

export class TerminalAccessPolicy {
  private readonly terminals: IAgentTerminals;

  public constructor(terminals: IAgentTerminals) {
    this.terminals = terminals;
  }

  public resolve(terminalId: string, context: ToolCallContext): AgentTerminalAccess {
    const terminal: IAgentTerminal | undefined = this.terminals.find(terminalId);
    const access: AgentTerminalAccess | null = Object.isUndefined(terminal) ? null
      : TerminalAccessPolicy.accessTo(terminal, context, this.ownerOf(context));
    if (Object.isNull(access))
      throw ToolFailures.create(ToolFailureCode.Refused, Resources.notFoundCode, Resources.formatTerminalNotFound(terminalId));
    return access;
  }

  public list(context: ToolCallContext): readonly AgentTerminalAccess[] {
    const accesses: AgentTerminalAccess[] = [];
    const sessionOwner: string | null = this.ownerOf(context);
    for (const terminal of this.terminals.list()) {
      const access: AgentTerminalAccess | null = TerminalAccessPolicy.accessTo(terminal, context, sessionOwner);
      if (!Object.isNull(access))
        accesses.push(access);
    }
    return accesses;
  }

  public listClosingWith(agentSessionId: string): readonly IAgentTerminal[] {
    return this.terminals.list().filter(t => t.ownerSessionId === agentSessionId && Object.isNull(t.owner));
  }

  public requireStill(access: AgentTerminalAccess, context: ToolCallContext): void {
    const terminal: IAgentTerminal | undefined = this.terminals.find(access.terminal.id);
    const now: AgentTerminalAccess | null = Object.isUndefined(terminal) ? null
      : TerminalAccessPolicy.accessTo(terminal, context, this.ownerOf(context));
    if (Object.isNull(now) || now.isShared !== access.isShared)
      throw ToolFailures.create(ToolFailureCode.Stale, Resources.staleCode, Resources.formatTerminalStale(access.terminal.id));
  }

  private ownerOf(context: ToolCallContext): string | null {
    return this.terminals.findSessionOwner(context.agentSessionId) ?? context.owner;
  }

  private static accessTo(terminal: IAgentTerminal, context: ToolCallContext, sessionOwner: string | null): AgentTerminalAccess | null {
    if (terminal.ownerSessionId === context.agentSessionId)
      return new AgentTerminalAccess(terminal, false);
    if (!Object.isNull(terminal.ownerSessionId) && !Object.isNull(sessionOwner) && terminal.owner === sessionOwner)
      return new AgentTerminalAccess(terminal, false);
    if (context.isBound(terminal.id))
      return new AgentTerminalAccess(terminal, true);
    return null;
  }
}
