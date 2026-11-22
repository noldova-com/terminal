/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import type { ForegroundProcess } from "@noldova/desktop.runtime";
import { TerminalSize } from "@noldova/terminal.protocol";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

import { Resources } from "../../src/resources.ts";
import { DeferredPtyProcess } from "../../src/services/deferred-pty-process.ts";
import { PseudoTerminal } from "../../src/services/pseudo-terminal.ts";
import { FakePtyProcess } from "../fixtures/fake-pty-process.fixture.ts";

const REQUEST: string = "\u001b[6n";
const ANSWER: string = "\u001b[4;3R";
const PROMPT: string = "$ ";

class Recorder {
  public readonly data: string[] = [];
  public readonly exits: (number | null)[] = [];
  public unaskedResizes: number = 0;
  public releases: number = 0;
  public release: () => void = () => undefined;

  public create(process: FakePtyProcess, isConPty: boolean = false): PseudoTerminal {
    return new PseudoTerminal(process, {
      onData: t => this.data.push(t),
      onExit: t => this.exits.push(t),
      onResizeUnasked: () => this.unaskedResizes++,
      onReleasingKeys: () => {
        this.releases++;
        this.release();
      }
    }, isConPty);
  }
}

describe("PseudoTerminal", () => {
  it("hands on its shell's foreground process, and null once the shell exited", async () => {
    const process: FakePtyProcess = new FakePtyProcess(7);
    const terminal: PseudoTerminal = new Recorder().create(process);
    process.foregroundProcessGroup = 9;

    const running: ForegroundProcess | null = await terminal.readForegroundProcessAsync();
    process.exit(0);

    assert.deepEqual([running?.group, await terminal.readForegroundProcessAsync()], [9, null]);
  });

  it("reports output, and an exit code unless a signal ended the shell or none was given", () => {
    const recorder: Recorder = new Recorder();
    const process: FakePtyProcess = new FakePtyProcess(7);
    const terminal: PseudoTerminal = recorder.create(process);

    process.emitData("hello");
    process.exit(3);
    process.exit(0, 0);
    process.exit(0, 1);
    process.exit(undefined);

    assert.equal(terminal.pid, 7);
    assert.deepEqual(recorder.data, ["hello"]);
    assert.deepEqual(recorder.exits, [3, 0, null, null]);
  });

  it("writes, resizes, pauses and resumes while the shell runs", () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = new Recorder().create(process);

    terminal.write("ls\r");
    terminal.resize(new TerminalSize(100, 30));
    terminal.pause();
    terminal.resume();

    assert.deepEqual(process.writes, ["ls\r"]);
    assert.deepEqual(process.sizes, ["100x30"]);
    assert.equal(process.pauses, 1);
    assert.equal(process.resumes, 1);
  });

  it("drops writes, resizes, pauses and resumes after the shell exits", () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = new Recorder().create(process);

    process.exit(0);
    terminal.write("ls\r");
    terminal.resize(new TerminalSize(100, 30));
    terminal.pause();
    terminal.resume();

    assert.deepEqual(process.writes, []);
    assert.deepEqual(process.sizes, []);
    assert.deepEqual([process.pauses, process.resumes], [0, 0]);
  });

  it("leaves ending the shell to the primitive", async () => {
    const recorder: Recorder = new Recorder();
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = recorder.create(process);

    assert.equal(await terminal.endAsync(), true);

    assert.equal(process.ends, 1);
    assert.deepEqual(recorder.exits, [null]);
  });

  it("reads a paused shell's output again when it ends the shell, and pauses it no more", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    process.isEndable = false;
    const terminal: PseudoTerminal = new Recorder().create(process);
    terminal.pause();

    await terminal.endAsync();
    terminal.pause();

    assert.deepEqual([process.pauses, process.resumes, process.ends], [1, 1, 1]);
  });

  it("ends a shell that exits by itself once, so its output worker stops, and one it ended no more", async () => {
    const exited: FakePtyProcess = new FakePtyProcess();
    const ended: FakePtyProcess = new FakePtyProcess();
    new Recorder().create(exited);
    const terminal: PseudoTerminal = new Recorder().create(ended);

    exited.exit(0);
    await terminal.endAsync();

    assert.deepEqual([exited.ends, ended.ends], [1, 1]);
  });

  it("reports a shell the primitive could not end", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    process.isEndable = false;

    assert.equal(await new Recorder().create(process).endAsync(), false);
  });
});

describe("PseudoTerminal's cursor requests on ConPTY", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("holds a key typed after the shell asks for the cursor's position, and writes the answer before it", () => {
    const recorder: Recorder = new Recorder();
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = recorder.create(process, true);

    terminal.resize(new TerminalSize(50, 9));
    process.emitData(REQUEST);
    terminal.write("e");
    const held: readonly string[] = [...process.writes];
    terminal.answer(ANSWER);
    terminal.write("cho");

    assert.deepEqual(held, []);
    assert.deepEqual(process.writes, [ANSWER, "e", "cho"]);
    assert.deepEqual(recorder.data, [REQUEST]);
  });

  it("writes the held keys after a short limit when no answer comes", () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = new Recorder().create(process, true);

    process.emitData(`prompt${REQUEST}`);
    terminal.write("e");
    terminal.write("c");
    vi.advanceTimersByTime(Resources.cursorAnswerMilliseconds - 1);
    const held: readonly string[] = [...process.writes];
    vi.advanceTimersByTime(1);
    terminal.write("ho");

    assert.deepEqual(held, []);
    assert.deepEqual(process.writes, ["e", "c", "ho"]);
  });

  it("holds a key typed between a resize and the cursor request ConPTY sends for it, and writes it after the answer", () => {
    const recorder: Recorder = new Recorder();
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = recorder.create(process, true);
    process.emitData(PROMPT);

    terminal.resize(new TerminalSize(50, 9));
    terminal.write("e");
    process.emitData(REQUEST);
    terminal.write("c");
    const held: readonly string[] = [...process.writes];
    terminal.answer(ANSWER);
    terminal.write("ho");

    assert.deepEqual(held, []);
    assert.deepEqual([process.writes, recorder.unaskedResizes, vi.getTimerCount()], [[ANSWER, "e", "c", "ho"], 0, 0]);
  });

  it("tells its listener once it no longer holds keys and before it writes the held ones, so a key written then goes ahead of them", () => {
    const recorder: Recorder = new Recorder();
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = recorder.create(process, true);
    process.emitData(PROMPT);
    recorder.release = () => terminal.write("\u0007");

    terminal.resize(new TerminalSize(50, 9));
    terminal.write("e");
    const isHolding: boolean = terminal.isHoldingKeys;
    process.emitData(REQUEST);
    terminal.answer(ANSWER);

    assert.deepEqual([isHolding, terminal.isHoldingKeys, recorder.releases, process.writes], [true, false, 1, [ANSWER, "\u0007", "e"]]);
  });

  it("tells its listener nothing when it releases no held keys, at an answer or at the limit", () => {
    const recorder: Recorder = new Recorder();
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = recorder.create(process, true);
    process.emitData(PROMPT);

    terminal.resize(new TerminalSize(50, 9));
    process.emitData(REQUEST);
    terminal.answer(ANSWER);
    terminal.resize(new TerminalSize(60, 9));
    vi.advanceTimersByTime(Resources.cursorAnswerMilliseconds);

    assert.deepEqual([recorder.releases, terminal.isHoldingKeys, process.writes], [0, false, [ANSWER]]);
  });

  it("expects one cursor request for resizes in quick succession, as ConPTY sends one", () => {
    const recorder: Recorder = new Recorder();
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = recorder.create(process, true);
    process.emitData(PROMPT);

    terminal.resize(new TerminalSize(80, 23));
    terminal.resize(new TerminalSize(80, 24));
    terminal.resize(new TerminalSize(66, 10));
    terminal.write("e");
    process.emitData(REQUEST);
    terminal.answer(ANSWER);

    assert.deepEqual([process.writes, recorder.unaskedResizes, vi.getTimerCount()], [[ANSWER, "e"], 0, 0]);
  });

  it("holds keys typed after a resize ConPTY asks nothing after no longer than the limit from the resize, and reports the missing request", () => {
    const recorder: Recorder = new Recorder();
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = recorder.create(process, true);
    process.emitData(PROMPT);

    terminal.resize(new TerminalSize(50, 9));
    process.emitData("\u001b[?25l\u001b[4;3H");
    terminal.write("e");
    vi.advanceTimersByTime(Resources.cursorAnswerMilliseconds - 1);
    terminal.write("c");
    const held: readonly string[] = [...process.writes];
    const reported: number = recorder.unaskedResizes;
    vi.advanceTimersByTime(1);
    terminal.write("ho");

    assert.deepEqual([held, reported], [[], 0]);
    assert.deepEqual([process.writes, recorder.unaskedResizes, vi.getTimerCount()], [["e", "c", "ho"], 1, 0]);
  });

  it("expects no cursor request from the fit that starts a deferred shell", async () => {
    const recorder: Recorder = new Recorder();
    const shell: FakePtyProcess = new FakePtyProcess();
    const deferred: DeferredPtyProcess = new DeferredPtyProcess(() => Promise.resolve(shell), 80, 24);
    const terminal: PseudoTerminal = new PseudoTerminal(deferred, { onData: () => undefined, onExit: () => undefined, onResizeUnasked: () => recorder.unaskedResizes++ }, true);

    terminal.resize(new TerminalSize(100, 30));
    await vi.advanceTimersByTimeAsync(0);
    shell.emitData(PROMPT);
    terminal.write("e");
    await vi.advanceTimersByTimeAsync(Resources.cursorAnswerMilliseconds);

    assert.deepEqual([deferred.hasStarted, shell.writes, recorder.unaskedResizes, vi.getTimerCount()], [true, ["e"], 0, 0]);
  });

  it("expects no cursor request from fits before ConPTY's first output", () => {
    const recorder: Recorder = new Recorder();
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = recorder.create(process, true);

    terminal.resize(new TerminalSize(80, 23));
    terminal.resize(new TerminalSize(80, 24));
    terminal.write("e");
    vi.advanceTimersByTime(Resources.cursorAnswerMilliseconds);

    assert.deepEqual([process.writes, recorder.unaskedResizes, vi.getTimerCount()], [["e"], 0, 0]);
  });

  it("writes keys at once after a resize on a pseudo terminal other than ConPTY", () => {
    const recorder: Recorder = new Recorder();
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = recorder.create(process);
    process.emitData(PROMPT);

    terminal.resize(new TerminalSize(50, 9));
    terminal.write("e");

    assert.deepEqual([process.writes, process.sizes, recorder.unaskedResizes, vi.getTimerCount()], [["e"], ["50x9"], 0, 0]);
  });

  it("releases the keys at the limit after a resize ConPTY asks nothing after when no one listens for the missing request", () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = new PseudoTerminal(process, { onData: () => undefined, onExit: () => undefined }, true);
    process.emitData(PROMPT);

    terminal.resize(new TerminalSize(50, 9));
    terminal.write("e");
    vi.advanceTimersByTime(Resources.cursorAnswerMilliseconds - 1);
    const held: readonly string[] = [...process.writes];
    vi.advanceTimersByTime(1);

    assert.deepEqual([held, process.writes, vi.getTimerCount()], [[], ["e"], 0]);
  });

  it("reports no missing cursor request when the shell exits during a resize's hold, and leaves no timer", () => {
    const recorder: Recorder = new Recorder();
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = recorder.create(process, true);
    process.emitData(PROMPT);

    terminal.resize(new TerminalSize(50, 9));
    terminal.write("e");
    process.exit(0);

    assert.deepEqual([process.writes, recorder.unaskedResizes, vi.getTimerCount()], [[], 0, 0]);
  });

  it("sees a request split across two reads of the output", () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = new Recorder().create(process, true);

    process.emitData("\u001b[6");
    process.emitData("n");
    terminal.write("e");
    const held: readonly string[] = [...process.writes];
    terminal.answer(ANSWER);

    assert.deepEqual(held, []);
    assert.deepEqual(process.writes, [ANSWER, "e"]);
  });

  it("holds keys until each of two open requests has its answer", () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = new Recorder().create(process, true);

    process.emitData(`${REQUEST}${REQUEST}`);
    terminal.write("e");
    terminal.answer(ANSWER);
    const held: readonly string[] = [...process.writes];
    terminal.answer("\u001b[5;3R");

    assert.deepEqual(held, [ANSWER]);
    assert.deepEqual(process.writes, [ANSWER, "\u001b[5;3R", "e"]);
  });

  it("counts a request that comes while another is open, and gives it a limit of its own", () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = new Recorder().create(process, true);

    process.emitData(REQUEST);
    vi.advanceTimersByTime(Resources.cursorAnswerMilliseconds - 1);
    process.emitData(REQUEST);
    terminal.write("e");
    terminal.answer(ANSWER);
    vi.advanceTimersByTime(Resources.cursorAnswerMilliseconds - 1);
    const held: readonly string[] = [...process.writes];
    const timers: number = vi.getTimerCount();
    vi.advanceTimersByTime(1);

    assert.deepEqual([held, timers], [[ANSWER], 1]);
    assert.deepEqual(process.writes, [ANSWER, "e"]);
  });

  it("never ends a hold on a typed key that looks like a cursor answer, such as Shift+F3", () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = new Recorder().create(process, true);

    process.emitData(REQUEST);
    terminal.write("\u001b[1;2R");
    terminal.write("e");
    const held: readonly string[] = [...process.writes];
    terminal.answer(ANSWER);

    assert.deepEqual(held, []);
    assert.deepEqual(process.writes, [ANSWER, "\u001b[1;2R", "e"]);
  });

  it("keeps holding through an answer to another query", () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = new Recorder().create(process, true);

    process.emitData(`\u001b[c${REQUEST}`);
    terminal.write("e");
    terminal.answer("\u001b[?1;2c");
    const held: readonly string[] = [...process.writes];
    terminal.answer(ANSWER);

    assert.deepEqual(held, ["\u001b[?1;2c"]);
    assert.deepEqual(process.writes, ["\u001b[?1;2c", ANSWER, "e"]);
  });

  it("writes an answer at once when no request is open, and none after the shell exits", () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = new Recorder().create(process, true);

    terminal.answer(ANSWER);
    process.exit(0);
    terminal.answer(ANSWER);

    assert.deepEqual(process.writes, [ANSWER]);
  });

  it("drops the held keys when the shell exits, and stops the limit", () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = new Recorder().create(process, true);

    process.emitData(REQUEST);
    terminal.write("e");
    process.exit(0);
    vi.advanceTimersByTime(Resources.cursorAnswerMilliseconds);

    assert.deepEqual(process.writes, []);
    assert.equal(vi.getTimerCount(), 0);
  });
});

describe("PseudoTerminal's cursor requests elsewhere", () => {
  it("writes keys at once after the shell asks for the cursor's position, on a pty that isn't ConPTY", () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = new Recorder().create(process);

    process.emitData(REQUEST);
    terminal.write("e");
    terminal.answer(ANSWER);

    assert.deepEqual(process.writes, ["e", ANSWER]);
  });
});
