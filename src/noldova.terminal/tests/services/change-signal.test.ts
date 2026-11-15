/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { afterEach, describe, it, vi } from "vitest";

import { ChangeSignal } from "../../src/services/change-signal.ts";

const SIGNAL: AbortSignal = new AbortController().signal;

describe("ChangeSignal", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits until a change makes the condition hold", async () => {
    vi.useFakeTimers();
    const signal: ChangeSignal = new ChangeSignal();
    let value: number = 0;
    let isDone: boolean = false;

    const waiting: Promise<void> = signal.waitUntilAsync(() => value === 2, 1_000, SIGNAL).then(() => {
      isDone = true;
    });
    value = 1;
    signal.notify();
    await vi.advanceTimersByTimeAsync(0);
    assert.equal(isDone, false);
    value = 2;
    signal.notify();
    await waiting;

    assert.equal(isDone, true);
  });

  it("returns at once when the condition already holds, holding no timer", async () => {
    vi.useFakeTimers();
    let checks: number = 0;

    await new ChangeSignal().waitUntilAsync(() => ++checks > 0, 1_000, SIGNAL);

    assert.deepEqual([checks, vi.getTimerCount()], [1, 0]);
  });

  it("returns when the time is up, and not before", async () => {
    vi.useFakeTimers();
    let isDone: boolean = false;
    const waiting: Promise<void> = new ChangeSignal().waitUntilAsync(() => false, 1_000, SIGNAL).then(() => {
      isDone = true;
    });

    await vi.advanceTimersByTimeAsync(999);
    const before: boolean = isDone;
    await vi.advanceTimersByTimeAsync(1);
    await waiting;

    assert.deepEqual([before, isDone, vi.getTimerCount()], [false, true, 0]);
  });

  it("returns when the call is aborted, clearing its timer, and checks no more on a change", async () => {
    vi.useFakeTimers();
    const signal: ChangeSignal = new ChangeSignal();
    const controller: AbortController = new AbortController();
    let checks: number = 0;
    const waiting: Promise<void> = signal.waitUntilAsync(() => ++checks < 0, 60_000, controller.signal);

    controller.abort();
    await waiting;
    signal.notify();
    await vi.advanceTimersByTimeAsync(0);

    assert.deepEqual([checks, vi.getTimerCount()], [2, 0]);
    await new ChangeSignal().waitUntilAsync(() => false, 1_000, controller.signal);
  });

  it("waits with no time limit until a change makes the condition hold, holding no timer", async () => {
    vi.useFakeTimers();
    const signal: ChangeSignal = new ChangeSignal();
    let value: number = 0;
    let isDone: boolean = false;

    const waiting: Promise<void> = signal.waitUntilAsync(() => value === 1, null, SIGNAL).then(() => {
      isDone = true;
    });
    await vi.advanceTimersByTimeAsync(60_000);
    const before: [boolean, number] = [isDone, vi.getTimerCount()];
    value = 1;
    signal.notify();
    await waiting;

    assert.deepEqual([before, isDone], [[false, 0], true]);
  });

  it("stops waiting with no time limit when the call is aborted", async () => {
    const controller: AbortController = new AbortController();
    const waiting: Promise<void> = new ChangeSignal().waitUntilAsync(() => false, null, controller.signal);

    controller.abort();

    await waiting;
  });
});
