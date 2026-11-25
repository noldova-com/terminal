/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class MissingFolder {
  public readonly path: string;
  public readonly mode: number;

  public constructor(path: string, mode: number) {
    this.path = path;
    this.mode = mode;
  }
}
