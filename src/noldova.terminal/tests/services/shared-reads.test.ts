/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ReadDroppedException } from "../../src/exceptions/read-dropped.exception.ts";
import { FolderEntry } from "../../src/models/folder-entry.ts";
import { SharedReads } from "../../src/services/shared-reads.ts";
import { FakeFileSystemReader } from "../fixtures/fake-file-system-reader.fixture.ts";

const OPEN: AbortSignal = new AbortController().signal;

describe("SharedReads", () => {
  it("shares one read of a folder's entries between callers while it runs", async () => {
    const reader: FakeFileSystemReader = new FakeFileSystemReader();
    reader.folders.add("/work/src");
    reader.files.set("/work/a.txt", "");
    const reads: SharedReads = new SharedReads(reader);

    const first: Promise<readonly FolderEntry[]> = reads.readEntriesAsync("/work", OPEN);
    const second: Promise<readonly FolderEntry[]> = reads.readEntriesAsync("/work", OPEN);

    assert.equal(second, first);
    assert.deepEqual(await first, [new FolderEntry("src", true), new FolderEntry("a.txt", false)]);
    assert.deepEqual(reader.listed, ["/work"]);
  });

  it("shares one read of a text and one of a program check per path while each runs", async () => {
    const reader: FakeFileSystemReader = new FakeFileSystemReader();
    reader.files.set("/etc/shells", "/bin/bash\n");
    const reads: SharedReads = new SharedReads(reader);

    const text: Promise<string | null> = reads.readTextOrNullAsync("/etc/shells", OPEN);
    const program: Promise<boolean> = reads.isProgramAsync("/etc/shells", OPEN);

    assert.equal(reads.readTextOrNullAsync("/etc/shells", OPEN), text);
    assert.equal(reads.isProgramAsync("/etc/shells", OPEN), program);
    assert.notEqual(reads.readTextOrNullAsync("/etc/passwd", OPEN), text);
    assert.notEqual(reads.isProgramAsync("/bin/bash", OPEN), program);
    assert.equal(await text, "/bin/bash\n");
    assert.equal(await program, true);
  });

  it("shares one read of a real path per path while it runs, and reads a failure with a system error code as none, but passes on a fault of its own", async () => {
    const reader: FakeFileSystemReader = new FakeFileSystemReader();
    reader.realPaths.set("C:\\PROGRA~1", "C:\\Program Files");
    reader.realPathFailures.set("R:\\", Object.assign(new Error("EISDIR: illegal operation on a directory"), { code: "EISDIR" }));
    reader.realPathFailures.set("V:\\", Object.assign(new Error("UNKNOWN: unknown error"), { code: "UNKNOWN" }));
    reader.realPathFailures.set("B:\\", new TypeError("broken"));
    const reads: SharedReads = new SharedReads(reader);

    const real: Promise<string | null> = reads.readRealPathOrNullAsync("C:\\PROGRA~1", OPEN);

    assert.equal(reads.readRealPathOrNullAsync("C:\\PROGRA~1", OPEN), real);
    assert.deepEqual([await real, await reads.readRealPathOrNullAsync("R:\\", OPEN), await reads.readRealPathOrNullAsync("V:\\", OPEN),
      await reads.readRealPathOrNullAsync("C:\\GONE~1", OPEN)], ["C:\\Program Files", null, null, null]);
    await assert.rejects(reads.readRealPathOrNullAsync("B:\\", OPEN), TypeError);
  });

  it("starts a new read of a path once the last one ended", async () => {
    const reader: FakeFileSystemReader = new FakeFileSystemReader();
    const reads: SharedReads = new SharedReads(reader);
    const first: Promise<string | null> = reads.readTextOrNullAsync("/work/a.txt", OPEN);
    await first;
    reader.files.set("/work/a.txt", "changed");

    const second: Promise<string | null> = reads.readTextOrNullAsync("/work/a.txt", OPEN);

    assert.notEqual(second, first);
    assert.equal(await second, "changed");
    assert.deepEqual(reader.listed, ["/work/a.txt", "/work/a.txt"]);
  });

  it("shares a failed read's failure, and reads again after it", async () => {
    const reader: FakeFileSystemReader = new FakeFileSystemReader();
    const stall: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    reader.stalled.set("/locked", stall.promise);
    const reads: SharedReads = new SharedReads(reader);
    const first: Promise<readonly FolderEntry[]> = reads.readEntriesAsync("/locked", OPEN);
    const second: Promise<readonly FolderEntry[]> = reads.readEntriesAsync("/locked", OPEN);

    stall.reject(new Error("EACCES"));

    await assert.rejects(first, new Error("EACCES"));
    await assert.rejects(second, new Error("EACCES"));
    reader.stalled.delete("/locked");
    assert.deepEqual(await reads.readEntriesAsync("/locked", OPEN), []);
    assert.deepEqual(reader.listed, ["/locked", "/locked"]);
  });

  it("runs at most two reads at once, starts the others in the order asked as each ends, and lets a started read finish though its caller stops", async () => {
    const reader: FakeFileSystemReader = new FakeFileSystemReader();
    const stall: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    reader.stalled.set("/a", stall.promise);
    reader.stalled.set("/b", stall.promise);
    reader.folders.add("/a/src");
    const reads: SharedReads = new SharedReads(reader);
    const stopping: AbortController = new AbortController();

    const all: readonly Promise<readonly FolderEntry[]>[] = [reads.readEntriesAsync("/a", stopping.signal), ...["/b", "/c", "/d"].map(t => reads.readEntriesAsync(t, OPEN))];
    const whileHeld: readonly string[] = [...reader.listed];
    stopping.abort();
    stall.resolve();
    const answers: readonly (readonly FolderEntry[])[] = await Promise.all(all);

    assert.deepEqual([whileHeld, reader.listed, answers[0]], [["/a", "/b"], ["/a", "/b", "/c", "/d"], [new FolderEntry("src", true)]]);
  });

  it("drops a read that hasn't started once every caller waiting for it stops, and starts the next one in its place", async () => {
    const reader: FakeFileSystemReader = new FakeFileSystemReader();
    const stall: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    reader.stalled.set("/a", stall.promise);
    reader.stalled.set("/b", stall.promise);
    const reads: SharedReads = new SharedReads(reader);
    const first: AbortController = new AbortController();
    const second: AbortController = new AbortController();
    const held: readonly Promise<readonly FolderEntry[]>[] = [reads.readEntriesAsync("/a", OPEN), reads.readEntriesAsync("/b", OPEN)];
    const dropped: Promise<readonly FolderEntry[]> = reads.readEntriesAsync("/c", first.signal);
    const shared: Promise<readonly FolderEntry[]> = reads.readEntriesAsync("/c", second.signal);
    const next: Promise<readonly FolderEntry[]> = reads.readEntriesAsync("/d", OPEN);

    first.abort();
    const afterFirst: string = await Promise.race([dropped.then(() => "settled", () => "settled"), Promise.resolve("waiting")]);
    second.abort();
    await assert.rejects(dropped, ReadDroppedException);
    stall.resolve();
    await Promise.all([...held, next]);

    assert.deepEqual([afterFirst, shared === dropped, reader.listed], ["waiting", true, ["/a", "/b", "/d"]]);
  });

  it("refuses a read asked for by a caller that already stopped, and starts nothing", async () => {
    const reader: FakeFileSystemReader = new FakeFileSystemReader();
    const reads: SharedReads = new SharedReads(reader);
    const stopped: AbortController = new AbortController();
    stopped.abort();

    await assert.rejects(reads.readTextOrNullAsync("/work/a.txt", stopped.signal), ReadDroppedException);
    assert.deepEqual(reader.listed, []);
  });
});
