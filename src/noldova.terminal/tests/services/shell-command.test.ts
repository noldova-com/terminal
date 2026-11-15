/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Resources as ProtocolResources, TerminalShellKind, TerminalSize } from "@noldova/terminal.protocol";
import { afterEach, describe, it, vi } from "vitest";

import { TerminalHistoryPaths } from "../../src/models/terminal-history-paths.ts";
import { Resources } from "../../src/resources.ts";
import { ShellCommand } from "../../src/services/shell-command.ts";
import { TerminalSession } from "../../src/services/terminal-session.ts";
import { OutputChunk } from "../../src/tools/models/output-chunk.ts";
import { FakePtyProcess } from "../fixtures/fake-pty-process.fixture.ts";
import { SessionRecorder } from "../fixtures/session-recorder.fixture.ts";

const SIGNAL: AbortSignal = new AbortController().signal;

function mark(kind: string, value?: string): string {
  return `\u001b]6973;${kind};n1${value === undefined ? "" : `;${value}`}\u0007`;
}

class CommandFixture {
  public readonly process: FakePtyProcess = new FakePtyProcess();
  public readonly session: TerminalSession;

  public constructor(textLimit: number = Resources.maximumAgentTextLength) {
    const folder: string = join(tmpdir(), `shell-command-none-${randomUUID()}`);
    this.session = new TerminalSession("s1", "bash", new TerminalSize(80, 24), this.process, "n1", null,
      new TerminalHistoryPaths(join(folder, "s1-1.jsonl"), join(folder, "s1-2.jsonl")), ProtocolResources.defaultStoredLimit,
      new SessionRecorder(), textLimit, TerminalShellKind.Other, false);
  }

  public run(timeoutMilliseconds: number = 0, command: string = "make"): ShellCommand {
    return new ShellCommand(this.session, command, timeoutMilliseconds, "/logs/s1.log");
  }
}

describe("ShellCommand", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("types the command and reads its output, exit code and folder from the marks", async () => {
    const fixture: CommandFixture = new CommandFixture();
    fixture.process.emitData(`$ ${mark("B")}`);
    const command: ShellCommand = fixture.run();

    fixture.process.emitData(`make\r\n${mark("C")}built\r\n${mark("P", "Cwd=/w")}${mark("D", "0")}${mark("A")}$ ${mark("B")}`);
    await command.waitForEndAsync(1_000, SIGNAL);

    assert.deepEqual(fixture.process.writes, ["make\r"]);
    assert.deepEqual([command.status, command.exitCode, command.cwd, command.logFile], ["Exited", 0, "/w", "/logs/s1.log"]);
    assert.deepEqual(command.readSince(0), new OutputChunk("built\n", 6));
    assert.deepEqual(command.readSince(3), new OutputChunk("lt\n", 6));
  });

  it("reports a running command's output so far, and its wait for a password", async () => {
    const fixture: CommandFixture = new CommandFixture();
    fixture.process.emitData(`$ ${mark("C")}x`);
    const command: ShellCommand = fixture.run();

    fixture.process.emitData(`make\r\n${mark("C")}step 1\r\n`);
    await command.waitForOutputAsync(0, 1_000, SIGNAL);

    assert.deepEqual([command.status, command.exitCode, command.cwd], ["Running", null, null]);
    assert.deepEqual(command.readSince(0), new OutputChunk("step 1\n", 7));
    fixture.process.emitData("Password: ");
    assert.equal(command.status, "AwaitingInput");
  });

  it("takes its output from where it was typed when the shell marks no output start", () => {
    const fixture: CommandFixture = new CommandFixture();
    fixture.process.emitData(`$ ${mark("B")}`);
    const command: ShellCommand = fixture.run();

    fixture.process.emitData(`make\r\nfailed\r\n${mark("D", "2")}`);

    assert.deepEqual([command.status, command.exitCode], ["Exited", 2]);
    assert.deepEqual(command.readSince(0), new OutputChunk("make\nfailed\n", 12));
  });

  it("ends as killed when its shell ends", async () => {
    const fixture: CommandFixture = new CommandFixture();
    const command: ShellCommand = fixture.run();

    fixture.process.exit(1);
    await command.waitForEndAsync(1_000, SIGNAL);
    await command.waitForOutputAsync(5, 1_000, SIGNAL);

    assert.equal(command.status, "Killed");
  });

  it("interrupts a command still running at its time limit, and reports it killed", async () => {
    vi.useFakeTimers();
    const fixture: CommandFixture = new CommandFixture();
    const command: ShellCommand = fixture.run(1_000);
    const ended: CommandFixture = new CommandFixture();
    const finished: ShellCommand = ended.run(1_000);
    ended.process.emitData(mark("D", "0"));

    await vi.advanceTimersByTimeAsync(1_000);
    const again: boolean = command.interrupt();
    fixture.process.emitData(mark("D", "130"));
    await vi.advanceTimersByTimeAsync(2_000);

    assert.equal(again, false);
    assert.equal(finished.interrupt(), false);
    assert.deepEqual(fixture.process.writes, ["make\r", "\u0003"]);
    assert.deepEqual([command.status, command.exitCode], ["Killed", 130]);
    assert.deepEqual(ended.process.writes, ["make\r"]);
    assert.equal(finished.status, "Exited");
  });

  it("lets go of its time limit once the command ends before it", async () => {
    vi.useFakeTimers();
    const fixture: CommandFixture = new CommandFixture();
    fixture.process.emitData(`$ ${mark("B")}`);
    const command: ShellCommand = fixture.run(3_600_000);

    fixture.process.emitData(`make\r\n${mark("C")}built\r\n${mark("D", "0")}`);
    await vi.advanceTimersByTimeAsync(1_000);

    assert.deepEqual([command.status, vi.getTimerCount()], ["Exited", 0]);
  });

  it("ends killed without a code at its time limit when no end mark comes within the grace after the interrupt, with the output it had", async () => {
    vi.useFakeTimers();
    const fixture: CommandFixture = new CommandFixture();
    fixture.process.emitData(`$ ${mark("B")}`);
    const command: ShellCommand = fixture.run(1_000);
    fixture.process.emitData(`make\r\n${mark("C")}step 1\r\n`);
    const ending: Promise<void> = command.waitForEndAsync(10_000, SIGNAL);

    await vi.advanceTimersByTimeAsync(2_999);
    const interrupted: string = command.status;
    await vi.advanceTimersByTimeAsync(1);
    await ending;
    fixture.process.emitData(`step 2\r\n${mark("P", "Cwd=/w")}${mark("D", "130")}`);

    assert.deepEqual(fixture.process.writes, ["make\r", "\u0003"]);
    assert.deepEqual([interrupted, command.status, command.exitCode, command.cwd], ["Running", "Killed", null, null]);
    assert.deepEqual(command.readSince(0), new OutputChunk("step 1\n", 7));
    assert.equal(command.interrupt(), false);
  });

  it("ends without a code at the next prompt on a new line when its shell marks nothing for it, as bash 3.2 for a subshell, not at a prompt redrawn in place", async () => {
    const fixture: CommandFixture = new CommandFixture();
    fixture.process.emitData(`${mark("A")}$ ${mark("B")}`);
    const command: ShellCommand = fixture.run(0, "(cd app && make)");
    const ending: Promise<void> = command.waitForEndAsync(1_000, SIGNAL);

    fixture.process.emitData(`(cd app && make)\r${mark("A")}$ ${mark("B")}(cd app && make)`);
    const redrawn: string = command.status;
    fixture.process.emitData(`\r\nbuilt\r\n${mark("P", "Cwd=/w/app")}${mark("A")}$ ${mark("B")}`);
    await ending;

    assert.deepEqual([redrawn, command.status, command.exitCode, command.cwd], ["Running", "Exited", null, null]);
    assert.deepEqual(command.readSince(0), new OutputChunk("(cd app && make)\n$ (cd app && make)\nbuilt\n", 42));
  });

  it("ends a command its shell marks nothing for at the first prompt after the shell's echo of it, not at an earlier or a later one", () => {
    const fixture: CommandFixture = new CommandFixture();
    fixture.process.emitData(`${mark("A")}$ ${mark("B")}`);
    const command: ShellCommand = fixture.run(0, "(cd app && make)");

    fixture.process.emitData(`\r\n[1]+  Done                    sleep 1\r\n${mark("A")}$ ${mark("B")}`);
    const early: string = command.status;
    fixture.process.emitData(`(cd app && make)\r\nbuilt\r\n${mark("A")}$ ${mark("B")}`);
    const ended: [string, number | null] = [command.status, command.exitCode];
    fixture.process.emitData(`ls\r\n${mark("C")}notes.txt\r\n${mark("D", "0")}${mark("A")}$ ${mark("B")}`);

    assert.deepEqual([early, ended, command.status, command.exitCode], ["Running", ["Exited", null], "Exited", null]);
    assert.deepEqual(command.readSince(0), new OutputChunk("\n[1]+  Done                    sleep 1\n$ (cd app && make)\nbuilt\n", 64));
  });

  it("ends a command its shell marks nothing for at its prompt after it printed more than the agent's text keeps", () => {
    const fixture: CommandFixture = new CommandFixture(16);
    fixture.process.emitData(`${mark("A")}$ ${mark("B")}`);
    const command: ShellCommand = fixture.run(0, "(cd app && make)");

    fixture.process.emitData(`(cd app && make)\r\n${"built\r\n".repeat(10)}${mark("A")}$ ${mark("B")}`);

    assert.deepEqual([command.status, command.exitCode], ["Exited", null]);
  });

  it("ends a command its shell marks nothing for at its prompt when the shell's echo of it wraps", () => {
    const fixture: CommandFixture = new CommandFixture();
    fixture.process.emitData(`${mark("A")}$ ${mark("B")}`);
    const command: ShellCommand = fixture.run(0, "(cd application && make all)");

    fixture.process.emitData(`(cd application && ma \rke all)\r\nbuilt\r\n${mark("A")}$ ${mark("B")}`);

    assert.deepEqual([command.status, command.exitCode, command.readSince(0).text], ["Exited", null, "(cd application && ma \nke all)\nbuilt\n"]);
  });

  it("takes only a line that ends with the command as its echo", () => {
    const fixture: CommandFixture = new CommandFixture();
    fixture.process.emitData(`${mark("A")}$ ${mark("B")}`);
    const command: ShellCommand = fixture.run(0, "(ls)");

    fixture.process.emitData(`\r\n[1]+  Done                    (ls) > files.txt\r\n${mark("A")}$ ${mark("B")}`);

    assert.equal(command.status, "Running");
  });

  it("takes no mark or prompt from the shell a restart started after its typing", () => {
    const fixture: CommandFixture = new CommandFixture();
    fixture.process.emitData(`${mark("A")}$ ${mark("B")}`);
    const command: ShellCommand = fixture.run(0, "ls");
    const next: FakePtyProcess = new FakePtyProcess(4_243);
    fixture.session.restart(next, "n1", new TerminalSize(80, 24));

    next.emitData(`${mark("A")}$ ${mark("B")}ls\r\n${mark("C")}notes.txt\r\n${mark("D", "0")}${mark("A")}$ ${mark("B")}`);

    assert.deepEqual([command.status, command.exitCode], ["Running", null]);
  });

  it("keeps a command with its own start mark running through a prompt before its end mark, and ended once its end mark came", () => {
    const fixture: CommandFixture = new CommandFixture();
    fixture.process.emitData(`${mark("A")}$ ${mark("B")}`);
    const command: ShellCommand = fixture.run(0, "bash");

    fixture.process.emitData(`bash\r\n${mark("C")}${mark("A")}nested$ ${mark("B")}exit\r\n`);
    const nested: string = command.status;
    fixture.process.emitData(`${mark("D", "0")}${mark("A")}$ ${mark("B")}ls\r\n${mark("C")}`);

    assert.deepEqual([nested, command.status, command.exitCode], ["Running", "Exited", 0]);
    assert.deepEqual(command.readSince(0), new OutputChunk("nested$ exit\n", 13));
  });

  it("ends killed without a code at the next prompt when interrupted and its shell marks no start or end for it", () => {
    const fixture: CommandFixture = new CommandFixture();
    fixture.process.emitData(`${mark("A")}$ ${mark("B")}`);
    const command: ShellCommand = fixture.run(0, "(sleep 100)");
    fixture.process.emitData(`(sleep 100)\r\n`);

    const interrupted: boolean = command.interrupt();
    fixture.process.emitData(`^C\r\n${mark("A")}$ ${mark("B")}`);

    assert.equal(interrupted, true);
    assert.deepEqual([command.status, command.exitCode, command.cwd], ["Killed", null, null]);
    assert.deepEqual(command.readSince(0), new OutputChunk("(sleep 100)\n^C\n", 15));
  });
});
