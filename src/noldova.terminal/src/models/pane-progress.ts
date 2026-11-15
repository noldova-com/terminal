/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PaneProgress {
  public offset: number;
  public isVisible: boolean = true;
  public stallTimer: NodeJS.Timeout | null = null;

  public constructor(offset: number) {
    this.offset = offset;
  }
}
