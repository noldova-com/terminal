/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { TerminalSize } from "@noldova/terminal.protocol";
import { describe, it } from "vitest";

import { PseudoTerminal } from "../../src/services/pseudo-terminal.ts";
import { FakePtyProcess } from "../fixtures/fake-pty-process.fixture.ts";

class Recorder {
  public readonly data: string[] = [];
  public readonly exits: (number | null)[] = [];

  public create(process: FakePtyProcess): PseudoTerminal {
    return new PseudoTerminal(process, { onData: t => this.data.push(t), onExit: t => this.exits.push(t) });
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
