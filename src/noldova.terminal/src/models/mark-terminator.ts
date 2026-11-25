/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class MarkTerminator {
  public readonly payloadEnd: number;
  public readonly end: number;

  public constructor(payloadEnd: number, end: number) {
    this.payloadEnd = payloadEnd;
    this.end = end;
  }
}
