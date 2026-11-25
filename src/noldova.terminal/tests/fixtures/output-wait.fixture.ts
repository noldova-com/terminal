/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class OutputWait {
  public readonly offset: number;
  public readonly timeoutMilliseconds: number;
  public readonly signal: AbortSignal;

  public constructor(offset: number, timeoutMilliseconds: number, signal: AbortSignal) {
    this.offset = offset;
    this.timeoutMilliseconds = timeoutMilliseconds;
    this.signal = signal;
  }
}
