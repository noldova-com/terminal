/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ShellLaunch {
  public readonly file: string;
  public readonly args: readonly string[] | string;
  public readonly environment: Readonly<Record<string, string>>;
  public readonly nonce: string | null;
  public readonly nonceFile: string | null;
  public readonly printsNote: boolean;

  public constructor(file: string, args: readonly string[] | string, environment: Readonly<Record<string, string>>, nonce: string | null,
    nonceFile: string | null = null, printsNote: boolean = false) {
    this.file = file;
    this.args = args;
    this.environment = environment;
    this.nonce = nonce;
    this.nonceFile = nonceFile;
    this.printsNote = printsNote;
  }
}
