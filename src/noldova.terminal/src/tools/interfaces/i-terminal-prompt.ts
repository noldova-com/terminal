/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface ITerminalPrompt {
  readonly isIdle: boolean;
  readonly cwd: string | null;
  readonly promptOffset: number | null;
  readonly isAwaitingSecret: boolean;
  readonly inputCount: number;

  equals(other: ITerminalPrompt): boolean;
}
