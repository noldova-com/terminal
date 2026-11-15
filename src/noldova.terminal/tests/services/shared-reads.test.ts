/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { FolderEntry } from "../../src/models/folder-entry.ts";
import { SharedReads } from "../../src/services/shared-reads.ts";
import { FakeFileSystemReader } from "../fixtures/fake-file-system-reader.fixture.ts";

describe("SharedReads", () => {
  it("shares one read of a folder's entries between callers while it runs", async () => {
    const reader: FakeFileSystemReader = new FakeFileSystemReader();
    reader.folders.add("/work/src");
    reader.files.set("/work/a.txt", "");
    const reads: SharedReads = new SharedReads(reader);

    const first: Promise<readonly FolderEntry[]> = reads.readEntriesAsync("/work");
    const second: Promise<readonly FolderEntry[]> = reads.readEntriesAsync("/work");

    assert.equal(second, first);
    assert.deepEqual(await first, [new FolderEntry("src", true), new FolderEntry("a.txt", false)]);
    assert.deepEqual(reader.listed, ["/work"]);
  });

  it("shares one read of a text and one of a program check per path while each runs", async () => {
    const reader: FakeFileSystemReader = new FakeFileSystemReader();
    reader.files.set("/etc/shells", "/bin/bash\n");
    const reads: SharedReads = new SharedReads(reader);

    const text: Promise<string | null> = reads.readTextOrNullAsync("/etc/shells");
    const program: Promise<boolean> = reads.isProgramAsync("/etc/shells");

    assert.equal(reads.readTextOrNullAsync("/etc/shells"), text);
    assert.equal(reads.isProgramAsync("/etc/shells"), program);
    assert.notEqual(reads.readTextOrNullAsync("/etc/passwd"), text);
    assert.notEqual(reads.isProgramAsync("/bin/bash"), program);
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

    const real: Promise<string | null> = reads.readRealPathOrNullAsync("C:\\PROGRA~1");

    assert.equal(reads.readRealPathOrNullAsync("C:\\PROGRA~1"), real);
    assert.deepEqual([await real, await reads.readRealPathOrNullAsync("R:\\"), await reads.readRealPathOrNullAsync("V:\\"),
      await reads.readRealPathOrNullAsync("C:\\GONE~1")], ["C:\\Program Files", null, null, null]);
    await assert.rejects(reads.readRealPathOrNullAsync("B:\\"), TypeError);
  });

  it("starts a new read of a path once the last one ended", async () => {
    const reader: FakeFileSystemReader = new FakeFileSystemReader();
    const reads: SharedReads = new SharedReads(reader);
    const first: Promise<string | null> = reads.readTextOrNullAsync("/work/a.txt");
    await first;
    reader.files.set("/work/a.txt", "changed");

    const second: Promise<string | null> = reads.readTextOrNullAsync("/work/a.txt");

    assert.notEqual(second, first);
    assert.equal(await second, "changed");
    assert.deepEqual(reader.listed, ["/work/a.txt", "/work/a.txt"]);
  });

  it("shares a failed read's failure, and reads again after it", async () => {
    const reader: FakeFileSystemReader = new FakeFileSystemReader();
    const stall: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    reader.stalled.set("/locked", stall.promise);
    const reads: SharedReads = new SharedReads(reader);
    const first: Promise<readonly FolderEntry[]> = reads.readEntriesAsync("/locked");
    const second: Promise<readonly FolderEntry[]> = reads.readEntriesAsync("/locked");

    stall.reject(new Error("EACCES"));

    await assert.rejects(first, new Error("EACCES"));
    await assert.rejects(second, new Error("EACCES"));
    reader.stalled.delete("/locked");
    assert.deepEqual(await reads.readEntriesAsync("/locked"), []);
    assert.deepEqual(reader.listed, ["/locked", "/locked"]);
  });
});
