/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FolderEntry } from "../models/folder-entry.ts";

export interface IFileSystemReader {
  isFileAsync(path: string): Promise<boolean>;

  isProgramAsync(path: string): Promise<boolean>;

  isFolderAsync(path: string): Promise<boolean>;

  readTextOrNullAsync(path: string): Promise<string | null>;

  readBytesOrNullAsync(path: string): Promise<Uint8Array | null>;

  readFolderNamesAsync(path: string): Promise<readonly string[]>;

  readEntriesAsync(path: string): Promise<readonly FolderEntry[]>;

  readRealPathOrNullAsync(path: string): Promise<string | null>;
}
