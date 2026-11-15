/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CommandListing {
  public readonly prompt: number;
  public readonly search: string;
  public readonly commands: readonly string[];

  public constructor(prompt: number, search: string, commands: readonly string[]) {
    this.prompt = prompt;
    this.search = search;
    this.commands = commands;
  }
}
