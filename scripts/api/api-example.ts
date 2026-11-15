/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ApiExample {
  public readonly file: string;
  public readonly line: number;
  public readonly code: string;

  public constructor(file: string, line: number, code: string) {
    this.file = file;
    this.line = line;
    this.code = code;
  }
}
