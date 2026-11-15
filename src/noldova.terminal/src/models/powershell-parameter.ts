/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PowerShellParameter {
  public readonly name: string;
  public readonly isSwitch: boolean;
  public readonly aliases: readonly string[];
  public readonly slot: string;

  public constructor(name: string, isSwitch: boolean, aliases: readonly string[] = [], slot: string = name) {
    this.name = name;
    this.isSwitch = isSwitch;
    this.aliases = aliases;
    this.slot = slot;
  }
}
