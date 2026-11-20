/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, it, vi } from "vitest";

import { FolderEntry } from "../../src/models/folder-entry.ts";
import { FileSystemReader } from "../../src/services/file-system.reader.ts";
import { SharedReads } from "../../src/services/shared-reads.ts";

const operations = vi.hoisted(() => ({ isCounting: false, running: 0, most: 0, held: new Array<PromiseWithResolvers<void>>() }));

vi.mock("node:fs/promises", async original => {
  const actual: typeof import("node:fs/promises") = await original();
  const counted = <A extends unknown[], R>(operation: (...args: A) => Promise<R>) => async (...args: A): Promise<R> => {
    if (!operations.isCounting)
      return operation(...args);
    operations.running++;
    operations.most = Math.max(operations.most, operations.running);
    const hold: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    operations.held.push(hold);
    await hold.promise;
    try {
      return await operation(...args);
    }
    finally {
      operations.running--;
    }
  };
  return { ...actual, readdir: counted(actual.readdir), stat: counted(actual.stat) };
});

describe("SharedReads on the file system", () => {
  let folder: string = "";

  beforeAll(async () => {
    folder = await mkdtemp(join(tmpdir(), "terminal-shared-reads-"));
    await mkdir(join(folder, "target"));
    for (const name of ["a", "b", "c"]) {
      await mkdir(join(folder, name));
      for (let i = 0; i < 4; i++)
        await symlink(join(folder, "target"), join(folder, name, `link${i}`), "junction");
    }
  });

  afterAll(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it("runs at most two file operations at once, a folder's link stats one at a time, however many links its folders hold", async () => {
    const reads: SharedReads = new SharedReads(new FileSystemReader());
    const signal: AbortSignal = new AbortController().signal;
    let isDone: boolean = false;
    operations.isCounting = true;
    const reading: Promise<readonly (readonly FolderEntry[])[]> = Promise.all(["a", "b", "c"].map(t => reads.readEntriesAsync(join(folder, t), signal)))
      .finally(() => {
        isDone = true;
      });
    while (!isDone) {
      await vi.waitFor(() => assert.ok(isDone || operations.held.length > 0));
      operations.held.shift()?.resolve();
    }
    const entries: readonly (readonly FolderEntry[])[] = await reading;
    operations.isCounting = false;

    const links: readonly FolderEntry[] = ["link0", "link1", "link2", "link3"].map(t => new FolderEntry(t, true));
    assert.deepEqual([operations.most, entries.map(t => [...t].sort((left, right) => left.name.localeCompare(right.name)))], [2, [links, links, links]]);
  });
});
