/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TerminalFolderKey {
  public readonly folder: string;
  public readonly key: string;

  public constructor(folder: string, key: string) {
    this.folder = folder;
    this.key = key;
  }
}
