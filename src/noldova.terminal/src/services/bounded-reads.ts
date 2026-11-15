/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FolderEntry } from "../models/folder-entry.ts";
import type { SharedReads } from "./shared-reads.ts";

export class BoundedReads {
  private readonly reader: SharedReads;
  private readonly expiry: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly timer: NodeJS.Timeout;
  private readonly pending: Set<Promise<unknown>> = new Set<Promise<unknown>>();
  private hasExpired: boolean = false;
  private hasCutShort: boolean = false;

  public constructor(reader: SharedReads, milliseconds: number) {
    this.reader = reader;
    this.timer = setTimeout(() => {
      this.hasExpired = true;
      this.expiry.resolve();
    }, milliseconds);
  }

  public get wasCutShort(): boolean {
    return this.hasCutShort;
  }

  public listPendingReads(): readonly Promise<unknown>[] {
    return [...this.pending];
  }

  public end(): void {
    clearTimeout(this.timer);
  }

  public readEntriesAsync(path: string): Promise<readonly FolderEntry[]> {
    return this.boundAsync(() => this.reader.readEntriesAsync(path), []);
  }

  public readTextOrNullAsync(path: string): Promise<string | null> {
    return this.boundAsync(() => this.reader.readTextOrNullAsync(path), null);
  }

  public isProgramAsync(path: string): Promise<boolean> {
    return this.boundAsync(() => this.reader.isProgramAsync(path), false);
  }

  public readRealPathOrNullAsync(path: string): Promise<string | null> {
    return this.boundAsync(() => this.reader.readRealPathOrNullAsync(path), null);
  }

  private async boundAsync<T>(read: () => Promise<T>, late: T): Promise<T> {
    if (this.hasExpired) {
      this.hasCutShort = true;
      return late;
    }
    const shared: Promise<T> = read();
    this.pending.add(shared);
    const tracked: Promise<T> = shared.finally(() => this.pending.delete(shared));
    const answer: { value: T } | null = await Promise.race([tracked.then(t => ({ value: t })), this.expiry.promise.then(() => null)]);
    if (answer !== null)
      return answer.value;
    this.hasCutShort = true;
    return late;
  }
}
