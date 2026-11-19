/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { constants } from "node:os";

import { PseudoTerminal, type PseudoTerminalForeground } from "@noldova/desktop.runtime";
import { describe, it, vi } from "vitest";

import type { IDisposable } from "../../src/interfaces/i-disposable.ts";
import type { IPtyExitEvent } from "../../src/interfaces/i-pty-exit-event.ts";
import { ContextPtyProcess } from "../../src/services/context-pty-process.ts";
import { FakePtyHandle } from "../fixtures/fake-pty-handle.fixture.ts";

function create(handle: FakePtyHandle, stops: PseudoTerminal[] = [], hasEnded: boolean = true): ContextPtyProcess {
  return new ContextPtyProcess(new PseudoTerminal(handle, "/bin/bash", new Date(), t => {
    stops.push(t);
    return Promise.resolve(hasEnded);
  }));
}

function waitForExitAsync(process: ContextPtyProcess): Promise<IPtyExitEvent> {
  return new Promise<IPtyExitEvent>(resolve => process.onExit(resolve));
}

class GroupedTerminal extends PseudoTerminal {
  public foreground: PseudoTerminalForeground | null = null;

  public override readForegroundAsync(): Promise<PseudoTerminalForeground | null> {
    return Promise.resolve(this.foreground);
  }
}

describe("ContextPtyProcess", () => {
  it("hands on the program's id, output, input, size and flow", () => {
    const handle: FakePtyHandle = new FakePtyHandle(4_343);
    const process: ContextPtyProcess = create(handle);
    const output: string[] = [];
    const subscription: IDisposable = process.onData(t => output.push(t));

    handle.emitData("first");
    process.write("ls\r");
    process.resize(120, 30);
    process.pause();
    process.resume();
    subscription.dispose();
    handle.emitData("after");

    assert.deepEqual([process.pid, output, handle.writes, handle.sizes, handle.pauses, handle.resumes], [4_343, ["first"], ["ls\r"], ["120x30"], 1, 1]);
  });

  it("hands on the foreground process group that the runtime reads, and the shell's own while that group still runs the shell's program", async () => {
    const terminal: GroupedTerminal = new GroupedTerminal(new FakePtyHandle(4_343), "/bin/bash", new Date(), () => Promise.resolve(true));
    const process: ContextPtyProcess = new ContextPtyProcess(terminal);

    const none: number | null = await process.readForegroundProcessGroupAsync();
    terminal.foreground = { group: 5_000, runsOwnProgram: true };
    const forked: number | null = await process.readForegroundProcessGroupAsync();
    terminal.foreground = { group: 5_000, runsOwnProgram: false };

    assert.deepEqual([none, forked, await process.readForegroundProcessGroupAsync()], [null, 4_343, 5_000]);
  });

  it("hands on the output that came before its listener once the listener has registered, before the output that follows", async () => {
    const handle: FakePtyHandle = new FakePtyHandle();
    const process: ContextPtyProcess = create(handle);
    const output: string[] = [];
    let isRegistered: boolean = false;
    handle.emitData("first");
    handle.emitData("second");

    process.onData(t => output.push(`${t}:${isRegistered}`));
    isRegistered = true;
    handle.emitData("third");
    const held: string[] = [...output];
    await new Promise<void>(resolve => queueMicrotask(resolve));
    handle.emitData("fourth");

    assert.deepEqual([held, output], [[], ["first:true", "second:true", "third:true", "fourth:true"]]);
  });

  it("hands on the rest of the output that came before it, and the output that follows, when its listener throws on a part of it, throwing each failure again", () => {
    const handle: FakePtyHandle = new FakePtyHandle();
    const process: ContextPtyProcess = create(handle);
    const output: string[] = [];
    const failures: string[] = [];
    const tasks: (() => void)[] = [];
    handle.emitData("first");
    handle.emitData("second");
    handle.emitData("third");

    vi.stubGlobal("queueMicrotask", (task: () => void) => tasks.push(task));
    try {
      process.onData(t => {
        if (t === "first" || t === "third")
          throw new Error(`The listener failed on ${t}.`);
        output.push(t);
      });
      for (let task: (() => void) | undefined = tasks.shift(); task !== undefined; task = tasks.shift())
        try {
          task();
        }
        catch (error: unknown) {
          failures.push(String(error));
        }
    }
    finally {
      vi.unstubAllGlobals();
    }
    handle.emitData("after");

    assert.deepEqual([failures, output], [["Error: The listener failed on first.", "Error: The listener failed on third."], ["second", "after"]]);
  });

  it("hands on the output that follows when its listener throws on the output that came before it", () => {
    const handle: FakePtyHandle = new FakePtyHandle();
    const process: ContextPtyProcess = create(handle);
    const output: string[] = [];
    const tasks: (() => void)[] = [];
    handle.emitData("first");

    vi.stubGlobal("queueMicrotask", (task: () => void) => tasks.push(task));
    try {
      process.onData(t => {
        if (t === "first")
          throw new Error("The listener failed.");
        output.push(t);
      });
      tasks.shift()?.();
      assert.throws(() => tasks.shift()?.(), /The listener failed/u);
    }
    finally {
      vi.unstubAllGlobals();
    }
    handle.emitData("after");

    assert.deepEqual([tasks.length, output], [0, ["after"]]);
  });

  it("hands no output that came before its listener to a listener disposed before it would reach it", async () => {
    const handle: FakePtyHandle = new FakePtyHandle();
    const process: ContextPtyProcess = create(handle);
    const output: string[] = [];
    handle.emitData("first");

    process.onData(t => output.push(t)).dispose();
    await new Promise<void>(resolve => queueMicrotask(resolve));
    handle.emitData("after");

    assert.deepEqual(output, []);
  });

  it("reports an exit code, a signal by its number, and an exit without either", async () => {
    const cases: [number | undefined, number | undefined, IPtyExitEvent][] = [
      [3, undefined, { exitCode: 3 }],
      [0, constants.signals.SIGHUP, { exitCode: undefined, signal: constants.signals.SIGHUP }],
      [undefined, undefined, { exitCode: undefined }]];
    for (const [exitCode, signal, expected] of cases) {
      const handle: FakePtyHandle = new FakePtyHandle();
      const process: ContextPtyProcess = create(handle);
      const exited: Promise<IPtyExitEvent> = waitForExitAsync(process);

      handle.exit(exitCode, signal);

      assert.deepEqual(await exited, expected);
    }
  });

  it("calls no exit listener that was disposed", async () => {
    const handle: FakePtyHandle = new FakePtyHandle();
    const process: ContextPtyProcess = create(handle);
    const calls: IPtyExitEvent[] = [];
    process.onExit(t => calls.push(t)).dispose();
    const exited: Promise<IPtyExitEvent> = waitForExitAsync(process);

    handle.exit(0);

    assert.deepEqual([await exited, calls], [{ exitCode: 0 }, []]);
  });

  it("ends the program through the runtime's stop, once, with whether everything ended in its grace", async () => {
    const stops: PseudoTerminal[] = [];
    const process: ContextPtyProcess = create(new FakePtyHandle(), stops, false);

    assert.deepEqual([await process.endAsync(), await process.endAsync(), stops.length], [false, false, 1]);
  });
});
