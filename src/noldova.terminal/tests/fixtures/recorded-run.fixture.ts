/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class RecordedRun {
  public readonly file: string;
  public readonly args: readonly string[];
  public readonly timeoutMilliseconds: number;

  public constructor(file: string, args: readonly string[], timeoutMilliseconds: number) {
    this.file = file;
    this.args = args;
    this.timeoutMilliseconds = timeoutMilliseconds;
  }
}
