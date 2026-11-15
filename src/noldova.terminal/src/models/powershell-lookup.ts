/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PowerShellLookup {
  public readonly shellNames: ReadonlySet<string>;
  public readonly search: string;
  public readonly answers: Map<string, boolean>;

  public constructor(shellNames: ReadonlySet<string>, search: string, answers: Map<string, boolean>) {
    this.shellNames = shellNames;
    this.search = search;
    this.answers = answers;
  }
}
