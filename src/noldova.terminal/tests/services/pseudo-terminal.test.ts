/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { TerminalSize } from "@noldova/terminal.protocol";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

import { Resources } from "../../src/resources.ts";
import { PseudoTerminal } from "../../src/services/pseudo-terminal.ts";
import { FakePtyProcess } from "../fixtures/fake-pty-process.fixture.ts";

const REQUEST: string = "\u001b[6n";
const ANSWER: string = "\u001b[4;3R";

class Recorder {
  public readonly data: string[] = [];
  public readonly exits: (number | null)[] = [];

  public create(process: FakePtyProcess, isConPty: boolean = false): PseudoTerminal {
    return new PseudoTerminal(process, { onData: t => this.data.push(t), onExit: t => this.exits.push(t) }, isConPty);
  }
}

describe("PseudoTerminal", () => {
  it("hands on its shell's foreground process group, and null once the shell exited", async () => {
    const process: FakePtyProcess = new FakePtyProcess(7);
    const terminal: PseudoTerminal = new Recorder().create(process);
    process.foregroundProcessGroup = 9;

    const running: number | null = await terminal.readForegroundProcessGroupAsync();
    process.exit(0);

    assert.deepEqual([running, await terminal.readForegroundProcessGroupAsync()], [9, null]);
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

  it("writes keys at once after a resize the shell asks nothing after", () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const terminal: PseudoTerminal = new Recorder().create(process, true);

    terminal.resize(new TerminalSize(50, 9));
    process.emitData("\u001b[?25l\u001b[4;3H");
    terminal.write("e");

    assert.deepEqual(process.writes, ["e"]);
    assert.equal(vi.getTimerCount(), 0);
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
