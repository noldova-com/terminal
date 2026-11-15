/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ITerminalPrompt } from "../tools/interfaces/i-terminal-prompt.ts";

export class TerminalPrompt implements ITerminalPrompt {
  public readonly isIdle: boolean;
  public readonly cwd: string | null;
  public readonly promptOffset: number | null;
  public readonly isAwaitingSecret: boolean;
  public readonly inputCount: number;

  public constructor(isIdle: boolean, cwd: string | null, promptOffset: number | null, isAwaitingSecret: boolean, inputCount: number) {
    this.isIdle = isIdle;
    this.cwd = cwd;
    this.promptOffset = promptOffset;
    this.isAwaitingSecret = isAwaitingSecret;
    this.inputCount = inputCount;
  }

  public equals(other: ITerminalPrompt): boolean {
    return other.isIdle === this.isIdle
      && other.cwd === this.cwd
      && other.promptOffset === this.promptOffset
      && other.isAwaitingSecret === this.isAwaitingSecret
      && other.inputCount === this.inputCount;
  }
}
