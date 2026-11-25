/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GrownDock {
  public readonly tab: string;
  public readonly minimum: number;

  public constructor(tab: string, minimum: number) {
    this.tab = tab;
    this.minimum = minimum;
  }
}
