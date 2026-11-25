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
import { SharedRead } from "../../src/models/shared-read.ts";

describe("SharedRead", () => {
  it("reads only once started, and answers with what the read gives", async () => {
    let reads: number = 0;
    const read: SharedRead<string> = new SharedRead(async () => {
      reads++;
      return "answer";
    });

    assert.equal(reads, 0);
    await read.startAsync();

    assert.equal(reads, 1);
    assert.equal(await read.promise, "answer");
  });

  it("rejects with what the read rejects with", async () => {
    const failure: Error = new Error("unreadable");
    const read: SharedRead<string> = new SharedRead(() => Promise.reject(failure));

    await read.startAsync();

    await assert.rejects(read.promise, failure);
  });

  it("drops the read, never reading, once its only watcher stops waiting before it starts", async () => {
    let reads: number = 0;
    let dropped: number = 0;
    const read: SharedRead<string> = new SharedRead(async () => {
      reads++;
      return "answer";
    });
    const watcher: AbortController = new AbortController();
    read.watch(watcher.signal, () => dropped++);

    watcher.abort();

    await assert.rejects(read.promise, ReadDroppedException);
    assert.equal(dropped, 1);
    assert.equal(reads, 0);
  });

  it("keeps the read while another watcher still waits, and drops it once the last one stops", async () => {
    let dropped: number = 0;
    const read: SharedRead<string> = new SharedRead(async () => "answer");
    const first: AbortController = new AbortController();
    const second: AbortController = new AbortController();
    read.watch(first.signal, () => dropped++);
    read.watch(second.signal, () => dropped++);

    first.abort();
    const droppedAfterFirst: number = dropped;
    second.abort();

    assert.equal(droppedAfterFirst, 0);
    assert.equal(dropped, 1);
    await assert.rejects(read.promise, ReadDroppedException);
  });

  it("answers a read that started though its watcher stops waiting afterwards", async () => {
    let dropped: number = 0;
    const read: SharedRead<string> = new SharedRead(async () => "answer");
    const watcher: AbortController = new AbortController();
    read.watch(watcher.signal, () => dropped++);
    const started: Promise<void> = read.startAsync();

    watcher.abort();
    await started;

    assert.equal(dropped, 0);
    assert.equal(await read.promise, "answer");
  });
});
