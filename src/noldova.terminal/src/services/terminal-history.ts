/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalLinePage, TerminalLineRange, type TerminalLine } from "@noldova/terminal.protocol";

import { StoredLinesUnwritableException } from "../exceptions/stored-lines-unwritable.exception.ts";
import type { TerminalHistoryPaths } from "../models/terminal-history-paths.ts";
import { Resources } from "../resources.ts";
import { TerminalHistorySegment } from "./terminal-history-segment.ts";

export class TerminalHistory {
  private readonly paths: TerminalHistoryPaths | null;
  private readonly segmentLimit: number;
  private readonly onWritten: () => void;
  private queue: Promise<void> = Promise.resolve();
  private older: TerminalHistorySegment | null = null;
  private newer: TerminalHistorySegment | null;
  private dropped: number = 0;
  private unwritten: number = 0;
  private failure: StoredLinesUnwritableException | null = null;
  private isClosed: boolean = false;

  public constructor(paths: TerminalHistoryPaths | null, limit: number, onWritten: () => void) {
    this.paths = paths;
    this.segmentLimit = Math.floor(limit / 2);
    this.onWritten = onWritten;
    this.newer = paths === null ? null : new TerminalHistorySegment(paths.first, 0);
    if (paths === null)
      this.fail(null);
  }

  public get stored(): TerminalLineRange {
    if (this.newer === null)
      return new TerminalLineRange(0, 0, 0);
    return new TerminalLineRange(this.older?.first ?? this.newer.first, this.newer.end, this.dropped);
  }

  public get backlog(): number {
    return this.unwritten;
  }

  public append(line: TerminalLine): void {
    if (this.paths === null || this.newer === null || this.failure !== null || this.isClosed)
      return;

    const text: string = `${JSON.stringify(line.toJson())}${Resources.lineFeed}`;
    const bytes: number = Buffer.byteLength(text, Resources.utf8Encoding);
    const segment: TerminalHistorySegment = this.newer.size > 0 && this.newer.size + bytes > this.segmentLimit
      ? this.rotate(this.paths, this.newer)
      : this.newer;
    if (!segment.hasBatch)
      void this.enqueueAsync(() => this.writeAsync(segment));
    segment.append(text, bytes);
    this.unwritten += bytes;
  }

  public clear(): void {
    if (this.isClosed || this.paths === null || this.newer === null)
      return;

    const end: number = this.newer.end;
    for (const segment of this.segments)
      this.discard(segment, true);
    this.older = null;
    this.newer = new TerminalHistorySegment(this.paths.first, end);
    this.dropped = 0;
  }

  public readAsync(start: number, limit: number): Promise<TerminalLinePage> {
    return this.enqueueAsync(() => this.readPageAsync(start, limit));
  }

  public async closeAsync(): Promise<readonly unknown[]> {
    this.isClosed = true;
    const removals: Promise<void>[] = this.segments.map(segment => {
      this.unwritten -= segment.discard();
      return this.enqueueAsync(() => segment.removeAsync());
    });
    return (await Promise.allSettled(removals)).filter(t => t.status === "rejected").map(t => t.reason as unknown);
  }

  private get segments(): readonly TerminalHistorySegment[] {
    return [this.older, this.newer].filter(t => t !== null);
  }

  private rotate(paths: TerminalHistoryPaths, newer: TerminalHistorySegment): TerminalHistorySegment {
    const path: string = this.older === null ? paths.second : this.older.path;
    if (this.older !== null) {
      this.dropped += this.older.end - this.older.first;
      this.discard(this.older, false);
    }
    this.older = newer;
    this.newer = new TerminalHistorySegment(path, newer.end);
    return this.newer;
  }

  private discard(segment: TerminalHistorySegment, isRemoved: boolean): void {
    this.unwritten -= segment.discard();
    void this.enqueueAsync(() => isRemoved ? segment.removeAsync() : segment.closeAsync()).catch((error: unknown) => this.fail(error));
  }

  private enqueueAsync<T>(operation: () => Promise<T>): Promise<T> {
    const result: Promise<T> = this.queue.then(operation);
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  private writeAsync(segment: TerminalHistorySegment): Promise<void> {
    return this.storeAsync(segment, segment.take());
  }

  private async storeAsync(segment: TerminalHistorySegment, buffer: Buffer): Promise<void> {
    if (buffer.length === 0)
      return;

    try {
      await segment.writeAsync(buffer);
    } catch (error: unknown) {
      this.fail(error);
    }
    this.unwritten -= buffer.length;
    this.onWritten();
  }

  private fail(error: unknown): void {
    this.failure = new StoredLinesUnwritableException(error);
  }

  private async readPageAsync(start: number, limit: number): Promise<TerminalLinePage> {
    const stored: TerminalLineRange = this.stored;
    const segments: readonly TerminalHistorySegment[] = this.segments;
    const pending: [TerminalHistorySegment, Buffer][] = segments.map(t => [t, t.take()]);
    for (const [segment, buffer] of pending)
      await this.storeAsync(segment, buffer);
    if (this.failure !== null)
      throw this.failure;

    const first: number = Math.min(Math.max(start, stored.start), stored.end);
    const last: number = Math.min(first + limit, stored.end);
    const lines: TerminalLine[] = [];
    for (const segment of segments) {
      const from: number = Math.min(Math.max(first, segment.first), segment.end);
      lines.push(...await segment.readAsync(from, Math.max(Math.min(last, segment.end) - from, 0)));
    }
    return new TerminalLinePage(first, lines, stored);
  }
}
