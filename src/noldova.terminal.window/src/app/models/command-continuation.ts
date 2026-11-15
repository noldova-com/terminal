/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IMarker } from "@xterm/xterm";

export class CommandContinuation {
  public readonly marker: IMarker;
  public readonly column: number;

  public constructor(marker: IMarker, column: number) {
    this.marker = marker;
    this.column = column;
  }
}
