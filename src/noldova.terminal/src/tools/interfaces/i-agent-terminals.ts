/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AgentTerminalOpening } from "../models/agent-terminal-opening.ts";
import type { IAgentTerminal } from "./i-agent-terminal.ts";

export interface IAgentTerminals {
  list(): readonly IAgentTerminal[];
  find(id: string): IAgentTerminal | undefined;
  openAsync(opening: AgentTerminalOpening, signal: AbortSignal): Promise<IAgentTerminal>;
  findSessionOwner(agentSessionId: string): string | null;
  endSession(agentSessionId: string): void;
}
