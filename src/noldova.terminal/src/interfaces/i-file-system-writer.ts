/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IFileSystemWriter {
  createPrivateFolderAsync(prefix: string): Promise<string>;

  writeTextAsync(path: string, text: string): Promise<void>;

  appendTextAsync(path: string, text: string): Promise<void>;

  removeFileAsync(path: string): Promise<void>;

  removeFolderAsync(path: string): Promise<void>;
}
