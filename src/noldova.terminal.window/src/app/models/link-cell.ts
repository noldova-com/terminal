/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IBufferCellPosition } from "@xterm/xterm";

export class LinkCell {
  public readonly text: string;
  public readonly start: IBufferCellPosition;
  public readonly end: IBufferCellPosition;

  public constructor(text: string, start: IBufferCellPosition, end: IBufferCellPosition) {
    this.text = text;
    this.start = start;
    this.end = end;
  }
}
