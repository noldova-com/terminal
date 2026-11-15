/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TerminalDockGrowth {
  public readonly rows: number;
  public release: (() => void) | null = null;

  public constructor(rows: number) {
    this.rows = rows;
  }
}
