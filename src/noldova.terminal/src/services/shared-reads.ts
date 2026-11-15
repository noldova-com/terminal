/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IFileSystemReader } from "../interfaces/i-file-system-reader.ts";
import type { FolderEntry } from "../models/folder-entry.ts";

export class SharedReads {
  private readonly reader: IFileSystemReader;
  private readonly entries: Map<string, Promise<readonly FolderEntry[]>> = new Map<string, Promise<readonly FolderEntry[]>>();
  private readonly texts: Map<string, Promise<string | null>> = new Map<string, Promise<string | null>>();
  private readonly programs: Map<string, Promise<boolean>> = new Map<string, Promise<boolean>>();
  private readonly realPaths: Map<string, Promise<string | null>> = new Map<string, Promise<string | null>>();

  public constructor(reader: IFileSystemReader) {
    this.reader = reader;
  }

  public readEntriesAsync(path: string): Promise<readonly FolderEntry[]> {
    return this.share(this.entries, path, () => this.reader.readEntriesAsync(path));
  }

  public readTextOrNullAsync(path: string): Promise<string | null> {
    return this.share(this.texts, path, () => this.reader.readTextOrNullAsync(path));
  }

  public isProgramAsync(path: string): Promise<boolean> {
    return this.share(this.programs, path, () => this.reader.isProgramAsync(path));
  }

  public readRealPathOrNullAsync(path: string): Promise<string | null> {
    return this.share(this.realPaths, path, () => this.reader.readRealPathOrNullAsync(path).catch((error: unknown) => {
      if (error instanceof Error && "code" in error)
        return null;
      throw error;
    }));
  }

  private share<T>(running: Map<string, Promise<T>>, path: string, read: () => Promise<T>): Promise<T> {
    const shared: Promise<T> | undefined = running.get(path);
    if (shared !== undefined)
      return shared;
    const started: Promise<T> = read().finally(() => running.delete(path));
    running.set(path, started);
    return started;
  }
}
