/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class EndWait {
  public readonly timeoutMilliseconds: number;
  public readonly signal: AbortSignal;

  public constructor(timeoutMilliseconds: number, signal: AbortSignal) {
    this.timeoutMilliseconds = timeoutMilliseconds;
    this.signal = signal;
  }
}
