/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IAgentCommand } from "./i-agent-command.ts";
import type { IOutputSource } from "./i-output-source.ts";
import type { ITerminalPrompt } from "./i-terminal-prompt.ts";

export interface IAgentTerminal extends IOutputSource {
  readonly id: string;
  readonly title: string;
  readonly name: string | null;
  readonly shellName: string;
  readonly shellId: string;
  readonly shellPath: string;
  readonly startFolder: string;
  readonly ownerSessionId: string | null;
  readonly owner: string | null;
  readonly hasShellIntegration: boolean;
  readonly isRunning: boolean;
  readonly isAwaitingSecret: boolean;
  readonly hasPendingLine: boolean;

  readPrompt(): ITerminalPrompt;
  readOneShotLine(command: string): string | null;
  run(command: string, expected: ITerminalPrompt, timeoutMilliseconds: number): IAgentCommand;
  write(keys: string, expected: ITerminalPrompt): void;
  interrupt(expected: ITerminalPrompt): void;
  closeAsync(): Promise<void>;
}
