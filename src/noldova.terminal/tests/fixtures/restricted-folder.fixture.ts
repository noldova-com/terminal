/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class RestrictedFolder {
  public readonly folder: string;
  public readonly fileCount: number;

  public constructor(folder: string, fileCount: number) {
    this.folder = folder;
    this.fileCount = fileCount;
  }
}
