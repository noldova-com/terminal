/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolFailureCode } from "@noldova/desktop.runtime";

import { Resources } from "../../resources.ts";
import type { IAgentTerminal } from "../interfaces/i-agent-terminal.ts";
import { ToolFailures } from "../services/tool-failures.ts";

export class AgentTerminalAccess {
  public readonly terminal: IAgentTerminal;
  public readonly isShared: boolean;

  public constructor(terminal: IAgentTerminal, isShared: boolean) {
    this.terminal = terminal;
    this.isShared = isShared;
  }

  public get origin(): string {
    return Resources.formatTerminalOrigin(this.terminal.id);
  }

  public requireRunning(): void {
    if (!this.terminal.isRunning)
      throw ToolFailures.create(ToolFailureCode.Unavailable, Resources.endedCode, Resources.formatTerminalEnded(this.terminal.id));
  }
}
