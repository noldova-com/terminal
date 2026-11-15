/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { Dirent } from "node:fs";
import { lstat, readdir, readFile, realpath, stat } from "node:fs/promises";
import { join } from "node:path";

import type { IFileSystemReader } from "../interfaces/i-file-system-reader.ts";
import { FolderEntry } from "../models/folder-entry.ts";
import { Resources } from "../resources.ts";

export class FileSystemReader implements IFileSystemReader {
  public async isFileAsync(path: string): Promise<boolean> {
    return (await FileSystemReader.readOrAsync(() => stat(path), null, Resources.unreadablePathCodes))?.isFile() ?? false;
  }

  public async isProgramAsync(path: string): Promise<boolean> {
    try {
      return (await stat(path)).isFile();
    }
    catch (error: unknown) {
      if (!FileSystemReader.hasCode(error, Resources.unreadablePathCodes))
        throw error;
      if (!FileSystemReader.hasCode(error, Resources.accessDeniedCodes))
        return false;
      return (await FileSystemReader.readOrAsync(() => lstat(path), null, Resources.unreadablePathCodes))?.isSymbolicLink() === true;
    }
  }

  public async isFolderAsync(path: string): Promise<boolean> {
    return (await FileSystemReader.readOrAsync(() => stat(path), null, Resources.unreadablePathCodes))?.isDirectory() ?? false;
  }

  public readTextOrNullAsync(path: string): Promise<string | null> {
    return FileSystemReader.readOrAsync(() => readFile(path, Resources.utf8Encoding), null, Resources.unreadablePathCodes);
  }

  public readBytesOrNullAsync(path: string): Promise<Uint8Array | null> {
    return FileSystemReader.readOrAsync(() => readFile(path), null, Resources.missingPathCodes);
  }

  public async readFolderNamesAsync(path: string): Promise<readonly string[]> {
    return (await FileSystemReader.readOrAsync(() => readdir(path, { withFileTypes: true }), [], Resources.unreadablePathCodes))
      .filter(t => t.isDirectory()).map(t => t.name);
  }

  public async readEntriesAsync(path: string): Promise<readonly FolderEntry[]> {
    const entries: readonly Dirent[] = await FileSystemReader.readOrAsync(() => readdir(path, { withFileTypes: true }), [], Resources.unreadablePathCodes);
    return Promise.all(entries.map(async t => new FolderEntry(t.name, t.isDirectory() || (t.isSymbolicLink() && await this.isFolderAsync(join(path, t.name))))));
  }

  public readRealPathOrNullAsync(path: string): Promise<string | null> {
    return FileSystemReader.readOrAsync(() => realpath(path), null, Resources.unreadablePathCodes);
  }

  private static async readOrAsync<T>(read: () => Promise<T>, fallback: T, codes: readonly string[]): Promise<T> {
    try {
      return await read();
    }
    catch (error: unknown) {
      if (FileSystemReader.hasCode(error, codes))
        return fallback;
      throw error;
    }
  }

  private static hasCode(error: unknown, codes: readonly string[]): boolean {
    return error instanceof Error && "code" in error && codes.includes(String(error.code));
  }
}
