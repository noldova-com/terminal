/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { afterEach, beforeEach, describe, it, vi } from "vitest";

import { ShellOptionsReply } from "../../src/models/shell-options-reply.ts";
import { ShellOptionsQueue } from "../../src/services/shell-options-queue.ts";

describe("ShellOptionsQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives each answer to the oldest waiting ask, in order", async () => {
    const queue: ShellOptionsQueue = new ShellOptionsQueue();
    const first: Promise<ShellOptionsReply> = queue.askAsync(1_000);
    const second: Promise<ShellOptionsReply> = queue.askAsync(1_000);

    queue.answer(["-a", "-l"]);
    queue.answer(["--help"]);

    assert.deepEqual(await first, new ShellOptionsReply(["-a", "-l"], false));
    assert.deepEqual(await second, new ShellOptionsReply(["--help"], false));
  });

  it("answers an ask the shell didn't answer in time as timed out", async () => {
    const queue: ShellOptionsQueue = new ShellOptionsQueue();
    const reply: Promise<ShellOptionsReply> = queue.askAsync(500);

    await vi.advanceTimersByTimeAsync(500);

    assert.equal(await reply, ShellOptionsReply.timedOut);
  });

  it("keeps a timed-out ask's place, so its late answer reaches no later ask", async () => {
    const queue: ShellOptionsQueue = new ShellOptionsQueue();
    const late: Promise<ShellOptionsReply> = queue.askAsync(500);
    await vi.advanceTimersByTimeAsync(500);
    const next: Promise<ShellOptionsReply> = queue.askAsync(1_000);

    queue.answer(["-late"]);
    queue.answer(["-next"]);

    assert.equal(await late, ShellOptionsReply.timedOut);
    assert.deepEqual(await next, new ShellOptionsReply(["-next"], false));
  });

  it("stops the timer of an answered ask", async () => {
    const queue: ShellOptionsQueue = new ShellOptionsQueue();
    const reply: Promise<ShellOptionsReply> = queue.askAsync(500);

    queue.answer(["-a"]);

    assert.equal(vi.getTimerCount(), 0);
    assert.deepEqual(await reply, new ShellOptionsReply(["-a"], false));
  });

  it("drops an answer no ask waits for, so a later ask doesn't take it", async () => {
    const queue: ShellOptionsQueue = new ShellOptionsQueue();

    queue.answer(["-a"]);
    const reply: Promise<ShellOptionsReply> = queue.askAsync(500);
    await vi.advanceTimersByTimeAsync(500);

    assert.equal(await reply, ShellOptionsReply.timedOut);
  });

  it("answers every waiting ask with no options when cancelled, keeping their places for the shell's answers", async () => {
    const queue: ShellOptionsQueue = new ShellOptionsQueue();
    const first: Promise<ShellOptionsReply> = queue.askAsync(1_000);
    const second: Promise<ShellOptionsReply> = queue.askAsync(1_000);

    queue.cancel();
    const next: Promise<ShellOptionsReply> = queue.askAsync(1_000);
    queue.answer(["-first"]);
    queue.answer(["-second"]);
    queue.answer(["-next"]);

    assert.equal(await first, ShellOptionsReply.none);
    assert.equal(await second, ShellOptionsReply.none);
    assert.deepEqual(await next, new ShellOptionsReply(["-next"], false));
    assert.equal(vi.getTimerCount(), 0);
  });

  it("answers every waiting ask with no options when reset, and gives the next answer to the next ask", async () => {
    const queue: ShellOptionsQueue = new ShellOptionsQueue();
    const waiting: Promise<ShellOptionsReply> = queue.askAsync(1_000);

    queue.reset();
    const next: Promise<ShellOptionsReply> = queue.askAsync(1_000);
    queue.answer(["-next"]);

    assert.equal(await waiting, ShellOptionsReply.none);
    assert.deepEqual(await next, new ShellOptionsReply(["-next"], false));
  });
});
