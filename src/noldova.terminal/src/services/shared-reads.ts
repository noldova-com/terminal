/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ReadDroppedException } from "../exceptions/read-dropped.exception.ts";
import type { IFileSystemReader } from "../interfaces/i-file-system-reader.ts";
import type { IQueuedRead } from "../interfaces/i-queued-read.ts";
import type { FolderEntry } from "../models/folder-entry.ts";
import { SharedRead } from "../models/shared-read.ts";
import { Resources } from "../resources.ts";

export class SharedReads {
  private readonly reader: IFileSystemReader;
  private readonly entries: Map<string, SharedRead<readonly FolderEntry[]>> = new Map<string, SharedRead<readonly FolderEntry[]>>();
  private readonly texts: Map<string, SharedRead<string | null>> = new Map<string, SharedRead<string | null>>();
  private readonly programs: Map<string, SharedRead<boolean>> = new Map<string, SharedRead<boolean>>();
  private readonly realPaths: Map<string, SharedRead<string | null>> = new Map<string, SharedRead<string | null>>();
  private readonly waiting: IQueuedRead[] = [];
  private running: number = 0;

  public constructor(reader: IFileSystemReader) {
    this.reader = reader;
  }

  public readEntriesAsync(path: string, signal: AbortSignal): Promise<readonly FolderEntry[]> {
    return this.share(this.entries, path, signal, () => this.reader.readEntriesAsync(path));
  }

  public readTextOrNullAsync(path: string, signal: AbortSignal): Promise<string | null> {
    return this.share(this.texts, path, signal, () => this.reader.readTextOrNullAsync(path));
  }

  public isProgramAsync(path: string, signal: AbortSignal): Promise<boolean> {
    return this.share(this.programs, path, signal, () => this.reader.isProgramAsync(path));
  }

  public readRealPathOrNullAsync(path: string, signal: AbortSignal): Promise<string | null> {
    return this.share(this.realPaths, path, signal, () => this.reader.readRealPathOrNullAsync(path).catch((error: unknown) => {
      if (error instanceof Error && "code" in error)
        return null;
      throw error;
    }));
  }

  private share<T>(running: Map<string, SharedRead<T>>, path: string, signal: AbortSignal, read: () => Promise<T>): Promise<T> {
    if (signal.aborted)
      return Promise.reject(new ReadDroppedException());
    let shared: SharedRead<T> | undefined = running.get(path);
    if (shared === undefined) {
      const created: SharedRead<T> = new SharedRead<T>(read);
      const settled = (): void => void running.delete(path);
      void created.promise.then(settled, settled);
      running.set(path, created);
      this.waiting.push(created);
      shared = created;
    }
    const watched: SharedRead<T> = shared;
    watched.watch(signal, () => void this.waiting.splice(this.waiting.indexOf(watched), 1));
    this.startWaiting();
    return watched.promise;
  }

  private startWaiting(): void {
    while (this.running < Resources.completionConcurrentReads) {
      const next: IQueuedRead | undefined = this.waiting.shift();
      if (next === undefined)
        return;
      this.running++;
      void next.startAsync().then(() => {
        this.running--;
        this.startWaiting();
      });
    }
  }
}
