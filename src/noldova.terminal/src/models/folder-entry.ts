/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FolderEntry {
  public readonly name: string;
  public readonly isFolder: boolean;

  public constructor(name: string, isFolder: boolean) {
    this.name = name;
    this.isFolder = isFolder;
  }
}
