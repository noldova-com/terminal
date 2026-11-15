/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { afterEach, beforeEach, describe, it, vi } from "vitest";

import { FolderEntry } from "../../src/models/folder-entry.ts";
import { BoundedReads } from "../../src/services/bounded-reads.ts";
import { SharedReads } from "../../src/services/shared-reads.ts";
import { FakeFileSystemReader } from "../fixtures/fake-file-system-reader.fixture.ts";

describe("BoundedReads", () => {
  let reader: FakeFileSystemReader;

  beforeEach(() => {
    vi.useFakeTimers();
    reader = new FakeFileSystemReader();
    reader.folders.add("/work/src");
    reader.files.set("/work/run.sh", "echo hi");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers each read that ends before its time, and is not cut short", async () => {
    const reads: BoundedReads = new BoundedReads(new SharedReads(reader), 100);

    const entries: readonly FolderEntry[] = await reads.readEntriesAsync("/work");
    const text: string | null = await reads.readTextOrNullAsync("/work/run.sh");
    const isProgram: boolean = await reads.isProgramAsync("/work/run.sh");
    reads.end();

    assert.deepEqual(entries, [new FolderEntry("src", true), new FolderEntry("run.sh", false)]);
    assert.equal(text, "echo hi");
    assert.equal(isProgram, true);
    assert.equal(reads.wasCutShort, false);
    assert.deepEqual(reads.listPendingReads(), []);
  });

  it("answers a read still running when its time ends as empty, is cut short, and keeps the read pending until it ends", async () => {
    const stall: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    reader.stalled.set("/work", stall.promise);
    reader.stalled.set("/work/run.sh", stall.promise);
    const reads: BoundedReads = new BoundedReads(new SharedReads(reader), 100);
    const entries: Promise<readonly FolderEntry[]> = reads.readEntriesAsync("/work");
    const text: Promise<string | null> = reads.readTextOrNullAsync("/work/run.sh");
    let isAnswered: boolean = false;
    void Promise.race([entries, text]).then(() => isAnswered = true);

    await vi.advanceTimersByTimeAsync(99);
    const before: [boolean, boolean] = [isAnswered, reads.wasCutShort];
    await vi.advanceTimersByTimeAsync(1);

    assert.deepEqual(before, [false, false]);
    assert.deepEqual(await entries, []);
    assert.equal(await text, null);
    assert.equal(reads.wasCutShort, true);
    const pending: readonly Promise<unknown>[] = reads.listPendingReads();
    assert.equal(pending.length, 2);
    stall.resolve();
    await Promise.all(pending);
    assert.deepEqual(reads.listPendingReads(), []);
  });

  it("answers a real path that ends before its time, and none for one still running when its time ends", async () => {
    const stall: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    reader.realPaths.set("C:\\PROGRA~1", "C:\\Program Files");
    reader.realPaths.set("C:\\SLOW~1", "C:\\Slow Drive");
    reader.stalled.set("C:\\SLOW~1", stall.promise);
    const reads: BoundedReads = new BoundedReads(new SharedReads(reader), 100);

    const quick: string | null = await reads.readRealPathOrNullAsync("C:\\PROGRA~1");
    const slow: Promise<string | null> = reads.readRealPathOrNullAsync("C:\\SLOW~1");
    await vi.advanceTimersByTimeAsync(100);

    assert.deepEqual([quick, await slow, reads.wasCutShort], ["C:\\Program Files", null, true]);
    stall.resolve();
    await Promise.all(reads.listPendingReads());
  });

  it("answers a read started after its time ended at once with the late answer, without reading", async () => {
    const reads: BoundedReads = new BoundedReads(new SharedReads(reader), 100);
    await vi.advanceTimersByTimeAsync(100);

    const answers: readonly unknown[] = [await reads.readEntriesAsync("/work"), await reads.readTextOrNullAsync("/work/run.sh"),
      await reads.isProgramAsync("/work/run.sh")];

    assert.deepEqual(answers, [[], null, false]);
    assert.equal(reads.wasCutShort, true);
    assert.deepEqual(reader.listed, []);
    assert.deepEqual(reads.listPendingReads(), []);
  });

  it("never runs out of time once ended", async () => {
    const stall: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    reader.stalled.set("/work/run.sh", stall.promise);
    const reads: BoundedReads = new BoundedReads(new SharedReads(reader), 100);
    const text: Promise<string | null> = reads.readTextOrNullAsync("/work/run.sh");

    reads.end();
    await vi.advanceTimersByTimeAsync(1_000);
    stall.resolve();

    assert.equal(await text, "echo hi");
    assert.equal(reads.wasCutShort, false);
  });
});
