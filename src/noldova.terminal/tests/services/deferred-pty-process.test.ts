/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import assert from "node:assert/strict";

import type { ForegroundProcess } from "@noldova/desktop.runtime";
import { afterEach, describe, it, vi } from "vitest";

import type { IPtyExitEvent } from "../../src/interfaces/i-pty-exit-event.ts";
import type { IPtyProcess } from "../../src/interfaces/i-pty-process.ts";
import { DeferredPtyProcess } from "../../src/services/deferred-pty-process.ts";
import { FakePtyProcess } from "../fixtures/fake-pty-process.fixture.ts";

class Starter {
  public readonly sizes: string[] = [];
  public readonly process: FakePtyProcess = new FakePtyProcess(7);
  public held: PromiseWithResolvers<IPtyProcess> | null = null;
  public failure: Error | null = null;

  public readonly startAsync = (columns: number, rows: number): Promise<IPtyProcess> => {
    this.sizes.push(`${columns}x${rows}`);
    return !Object.isNull(this.failure) ? Promise.reject(this.failure) : this.held?.promise ?? Promise.resolve(this.process);
  };

  public startedAsync(): Promise<void> {
    return this.process.waitUntilReadAsync();
  }

  public create(): [DeferredPtyProcess, string[], IPtyExitEvent[]] {
    const deferred: DeferredPtyProcess = new DeferredPtyProcess(this.startAsync, 80, 24);
    const data: string[] = [];
    const exits: IPtyExitEvent[] = [];
    deferred.onData(t => data.push(t));
    deferred.onExit(t => exits.push(t));
    return [deferred, data, exits];
  }
}

describe("DeferredPtyProcess", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts its shell at its first resize's size, then passes on its output, exit, writes and sizes, and drops what was written before", async () => {
    const starter: Starter = new Starter();
    const [deferred, data, exits] = starter.create();
    const dropped: string[] = [];
    deferred.onData(t => dropped.push(t)).dispose();
    deferred.onExit(t => dropped.push(String(t.exitCode))).dispose();

    deferred.write("early");
    const pidBefore: number | null = deferred.pid;
    deferred.resize(120, 30);
    await starter.startedAsync();
    deferred.write("ls\r");
    deferred.resize(100, 30);
    starter.process.emitData("out");
    starter.process.exit(3);

    assert.deepEqual([pidBefore, starter.sizes, starter.process.writes, starter.process.sizes, data, exits, dropped],
      [null, ["120x30"], ["ls\r"], ["100x30"], ["out"], [{ exitCode: 3 }], []]);
    assert.equal(await deferred.endAsync(), true);
  });

  it("has no foreground process until its shell starts, then its shell's", async () => {
    const starter: Starter = new Starter();
    const [deferred] = starter.create();
    starter.process.foregroundProcessGroup = 42;

    const before: ForegroundProcess | null = await deferred.readForegroundProcessAsync();
    deferred.resize(120, 30);
    await starter.startedAsync();

    assert.deepEqual([before, deferred.pid, (await deferred.readForegroundProcessAsync())?.group], [null, 7, 42]);
    assert.equal(await deferred.endAsync(), true);
  });

  it("waits for a resize or a start however long it takes, then starts its shell at the size it opened with, once", async () => {
    vi.useFakeTimers();
    const starter: Starter = new Starter();
    const [deferred] = starter.create();

    await vi.advanceTimersByTimeAsync(60_000);
    const before: [readonly string[], boolean, number] = [[...starter.sizes], deferred.hasStarted, vi.getTimerCount()];
    deferred.start();
    deferred.start();

    assert.deepEqual([before, starter.sizes, deferred.hasStarted], [[[], false, 0], ["80x24"], true]);
  });

  it("holds a pause until its shell starts, but not one a resume lifted, and passes on later ones", async () => {
    const paused: Starter = new Starter();
    const [pausedProcess] = paused.create();
    const resumed: Starter = new Starter();
    const [resumedProcess] = resumed.create();

    pausedProcess.pause();
    resumedProcess.pause();
    resumedProcess.resume();
    pausedProcess.resize(120, 30);
    resumedProcess.resize(120, 30);
    await Promise.all([paused.startedAsync(), resumed.startedAsync()]);
    pausedProcess.resume();

    assert.deepEqual([pausedProcess.pid, resumedProcess.pid, paused.process.pauses, paused.process.resumes, resumed.process.pauses, resumed.process.resumes], [7, 7, 1, 1, 0, 0]);
  });

  for (const [label, lastColumns, sizes] of [["another size", 100, ["100x30"]], ["the size it started at", 120, []]] as const)
    it(`starts its shell once, and gives it ${label} that came while it started once it has`, async () => {
      const starter: Starter = new Starter();
      starter.held = Promise.withResolvers<IPtyProcess>();
      const [deferred] = starter.create();

      deferred.resize(120, 30);
      deferred.resize(lastColumns, 30);
      deferred.start();
      starter.held.resolve(starter.process);
      await starter.startedAsync();

      assert.deepEqual([deferred.pid, starter.sizes, starter.process.sizes], [7, ["120x30"], sizes]);
    });

  it("never starts its shell once ended first, exiting at once with no code, once", async () => {
    const starter: Starter = new Starter();
    const [deferred, , exits] = starter.create();

    const ended: boolean = await deferred.endAsync();
    deferred.resize(120, 30);
    deferred.start();

    assert.deepEqual([ended, await deferred.endAsync(), starter.sizes, deferred.pid, exits], [true, true, [], null, [{ exitCode: undefined }]]);
  });

  it("ends a shell that was starting as it ended, once it has started", async () => {
    const starter: Starter = new Starter();
    starter.held = Promise.withResolvers<IPtyProcess>();
    const [deferred, , exits] = starter.create();

    deferred.resize(120, 30);
    const ending: Promise<boolean> = deferred.endAsync();
    starter.held.resolve(starter.process);

    assert.deepEqual([await ending, starter.process.ends, exits], [true, 1, [{ exitCode: 0, signal: 1 }]]);
  });

  it("exits with no code, once, when its shell can't start", async () => {
    const starter: Starter = new Starter();
    starter.failure = new Error("spawn failed");
    const [deferred, , exits] = starter.create();
    const exited: Promise<void> = new Promise<void>(resolve => deferred.onExit(() => resolve()));

    deferred.resize(120, 30);
    await exited;

    assert.deepEqual([await deferred.endAsync(), deferred.pid, exits], [true, null, [{ exitCode: undefined }]]);
  });
});
