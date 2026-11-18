/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Resources as ProtocolResources, TerminalShellKind, TerminalSize, WindowsPty, type TerminalAttachment, type TerminalLinePage } from "@noldova/terminal.protocol";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

import { StoredLinesUnwritableException } from "../../src/exceptions/stored-lines-unwritable.exception.ts";
import type { MirrorLine } from "../../src/models/mirror-line.ts";
import { ShellOptionsReply } from "../../src/models/shell-options-reply.ts";
import { TerminalHistoryPaths } from "../../src/models/terminal-history-paths.ts";
import { TrackedCommand } from "../../src/models/tracked-command.ts";
import { Resources } from "../../src/resources.ts";
import { TerminalSession } from "../../src/services/terminal-session.ts";
import { FakePtyProcess } from "../fixtures/fake-pty-process.fixture.ts";
import { SessionRecorder } from "../fixtures/session-recorder.fixture.ts";

const MEBIBYTE: number = 1_048_576;

class RefusingRecorder extends SessionRecorder {
  public readonly refused: string[] = [];

  public override onCommandStarted(command: string): void {
    this.refused.push(command);
    throw new Error("The commands are full.");
  }
}

function createSession(
  process: FakePtyProcess,
  recorder: SessionRecorder,
  size: TerminalSize = new TerminalSize(80, 24),
  windowsPty: WindowsPty | null = null,
  nonce: string | null = null,
  shellKind: TerminalShellKind = TerminalShellKind.Other): TerminalSession {
  return new TerminalSession("s1", "bash", size, process, nonce, windowsPty, null, ProtocolResources.defaultStoredLimit, recorder,
    Resources.maximumAgentTextLength, shellKind, false);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("TerminalSession", () => {

  it("sends the shell's output as numbered batches", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createSession(process, recorder);

    process.emitData("one ");
    process.emitData("two");
    await vi.waitFor(() => assert.equal(recorder.text, "one two"));
    process.emitData("!");
    await vi.waitFor(() => assert.equal(recorder.outputs.length, 2));

    assert.deepEqual(recorder.outputs.map(t => [t.sessionId, t.offset]), [["s1", 0], ["s1", 7]]);
    assert.equal(session.pid, 4_242);
    await session.disposeAsync();
  });

  it("tracks commands from the shell's marks across output chunks", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createSession(process, new SessionRecorder(), new TerminalSize(80, 24), null,"n1");

    process.emitData("$ \u001b]6973;C;n1\u0007");
    process.emitData("out\n\u001b]6973;P;n1;Cwd=/work\u0007\u001b]6973;D");
    process.emitData(";n1;3\u0007");

    const expected: TrackedCommand = new TrackedCommand(2, true);
    expected.end(6, 3, "/work");
    assert.deepEqual(session.commands.lastCommand, expected);
    assert.equal(session.text.readSince(0).text, "$ out\n");
    await session.disposeAsync();
  });

  it("reports each command's end with its exit code, and without one when the mark has none or the protocol can't carry it, and each prompt's start", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createSession(process, recorder, new TerminalSize(80, 24), null,"n1");

    process.emitData("\u001b]6973;C;n1\u0007\u001b]6973;D;n1;0\u0007\u001b]6973;D;n1;-1\u0007\u001b]6973;D;n1\u0007\u001b]6973;D;n1;-9999999999\u0007");
    process.emitData("\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007\u001b]6973;A;n1\u0007");

    assert.deepEqual(recorder.commandEnds.map(t => [t.sessionId, t.exitCode]), [["s1", 0], ["s1", -1], ["s1", null], ["s1", null]]);
    assert.deepEqual(recorder.promptStarts.map(t => t.sessionId), ["s1", "s1"]);
    await session.disposeAsync();
  });

  it("reports each new working folder the shell's integration gives, and attaches with the last", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createSession(process, recorder, new TerminalSize(80, 24), null,"n1");

    process.emitData("\u001b]6973;P;n1;Cwd=/work\u0007$ ");
    process.emitData("\u001b]6973;P;n1;Cwd=/work\u0007$ \u001b]6973;P;n1;Cwd=/work/a\\x3bb\u0007$ ");
    const attachment: TerminalAttachment = await session.attachAsync("p1", []);

    assert.deepEqual(recorder.cwds.map(t => t.toJson()), [{ sessionId: "s1", cwd: "/work" }, { sessionId: "s1", cwd: "/work/a;b" }]);
    assert.equal(attachment.cwd, "/work/a;b");
    await session.disposeAsync();
  });

  it("gives its panes the kind of shell it runs, which they read the typed line as", async () => {
    const powerShell: TerminalSession = createSession(new FakePtyProcess(), new SessionRecorder(), new TerminalSize(80, 24), null,"n1", TerminalShellKind.PowerShell);
    const other: TerminalSession = createSession(new FakePtyProcess(), new SessionRecorder());

    assert.deepEqual([(await powerShell.attachAsync("p1", [])).shellKind, (await other.attachAsync("p1", [])).shellKind],
      [TerminalShellKind.PowerShell, TerminalShellKind.Other]);
    await powerShell.disposeAsync();
    await other.disposeAsync();
  });

  it.each([["blank", " "], ["longer than 4096 characters", "/".repeat(4_097)]])(
    "keeps the last working folder when the integration reports one %s",
    async (_: string, cwd: string) => {
      const process: FakePtyProcess = new FakePtyProcess();
      const recorder: SessionRecorder = new SessionRecorder();
      const session: TerminalSession = createSession(process, recorder, new TerminalSize(80, 24), null,"n1");

      process.emitData(`\u001b]6973;P;n1;Cwd=/work\u0007$ \u001b]6973;P;n1;Cwd=${cwd}\u0007$ `);
      const attachment: TerminalAttachment = await session.attachAsync("p1", []);

      assert.deepEqual(recorder.cwds.map(t => t.cwd), ["/work"]);
      assert.equal(attachment.cwd, "/work");
      await session.disposeAsync();
    });

  it("attaches with no working folder when the shell has no integration", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createSession(process, recorder);

    process.emitData("\u001b]6973;P;n1;Cwd=/work\u0007$ ");

    assert.equal((await session.attachAsync("p1", [])).cwd, null);
    assert.deepEqual(recorder.cwds, []);
    await session.disposeAsync();
  });

  it("forgets the old shell's working folder when it restarts, until the new shell reports its own", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createSession(process, new SessionRecorder(), new TerminalSize(80, 24), null, "n1");
    process.emitData("\u001b]6973;P;n1;Cwd=/work/a\u0007$ ");
    const restarted: FakePtyProcess = new FakePtyProcess();

    session.restart(restarted, "n2", new TerminalSize(80, 24));

    assert.equal(session.cwd, null);
    assert.equal((await session.attachAsync("p1", [])).cwd, null);
    restarted.emitData("\u001b]6973;P;n2;Cwd=/work/b\u0007$ ");
    assert.equal(session.cwd, "/work/b");
    await session.disposeAsync();
  });

  it("ignores marks when the shell has no integration", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createSession(process, new SessionRecorder());

    process.emitData("\u001b]6973;D;n1;0\u0007");

    assert.equal(session.commands.hasMarks, false);
    await session.disposeAsync();
  });

  it("answers the shell's terminal queries from the mirror", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createSession(process, new SessionRecorder());

    process.emitData("\u001b[6n");

    await vi.waitFor(() => assert.deepEqual(process.writes, ["\u001b[1;1R"]));
    await session.disposeAsync();
  });

  it("writes a key typed after a Windows shell's cursor request behind the mirror's answer", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createSession(process, new SessionRecorder(), new TerminalSize(80, 24), new WindowsPty(26_100));

    process.emitData("\u001b[6n");
    session.write("e");

    await vi.waitFor(() => assert.deepEqual(process.writes, ["\u001b[1;1R", "e"]));
    await session.disposeAsync();
  });

  it("writes a key typed after another system's cursor request at once", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createSession(process, new SessionRecorder());

    process.emitData("\u001b[6n");
    session.write("e");

    assert.deepEqual(process.writes, ["e"]);
    await vi.waitFor(() => assert.deepEqual(process.writes, ["e", "\u001b[1;1R"]));
    await session.disposeAsync();
  });

  it("reports title changes", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createSession(process, recorder);

    process.emitData("\u001b]2;make\u0007");

    await vi.waitFor(() => assert.deepEqual(recorder.titles.map(t => t.title), ["make"]));
    assert.equal(session.toSummary("/work", false, false, null, true, null, null).title, "make");
    await session.disposeAsync();
  });

  it("sends the last output before the shell's exit", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createSession(process, recorder);

    process.emitData("bye");
    process.exit(3);

    assert.equal(recorder.text, "bye");
    assert.deepEqual(recorder.exits.map(t => t.toJson()), [{ sessionId: "s1", exit: { exitCode: 3, endedBy: "Exit" } }]);
    assert.deepEqual(session.toSummary("/work", true, false, null, true, null, null).toJson(), {
      sessionId: "s1",
      shellId: "bash",
      folder: "/work",
      title: "",
      exit: { exitCode: 3, endedBy: "Exit" },
      isAgentTerminal: true,
      isPanelTerminal: false,
      owner: null, opensTab: true, name: null, shellName: null, shellKind: "Other"
    });
    await session.disposeAsync();
  });

  it("reports a terminal it was asked to end as closed", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createSession(process, recorder);

    assert.equal(await session.endAsync(), true);

    assert.equal(process.ends, 1);
    assert.deepEqual(recorder.exits.map(t => t.toJson()), [{ sessionId: "s1", exit: { exitCode: null, endedBy: "Close" } }]);
    await session.disposeAsync();
  });

  it("ends a shell that left its prompt only once it draws the next one, since bash hangs up its jobs only outside its prompt hooks", async () => {
    vi.useFakeTimers();
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createSession(process, recorder, new TerminalSize(80, 24), null, "n1");
    process.emitData("\u001b]6973;B;n1\u0007sleep 600 &\r\n\u001b]6973;C;n1\u0007[1] 4243\r\n");

    const ending: Promise<boolean> = session.endAsync();
    await vi.advanceTimersByTimeAsync(499);
    const endsBeforePrompt: number = process.ends;
    process.emitData("\u001b]6973;D;n1;0\u0007\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007");

    assert.equal(await ending, true);
    assert.deepEqual([endsBeforePrompt, process.ends], [0, 1]);
    await session.disposeAsync();
  });

  it("ends a shell entered a line at its prompt only once it draws the next one, since bash only notes a hangup before readline takes a line", async () => {
    vi.useFakeTimers();
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createSession(process, new SessionRecorder(), new TerminalSize(80, 24), null, "n1");
    process.emitData("\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007");
    session.write("echo $((20 + 22))\r");
    process.emitData("echo $((20 + 22))\r\n\u001b[?2004l\r");

    const ending: Promise<boolean> = session.endAsync();
    await vi.advanceTimersByTimeAsync(499);
    const endsBeforePrompt: number = process.ends;
    process.emitData("\u001b]6973;C;n1\u000742\r\n\u001b]6973;D;n1;0\u0007\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007");

    assert.equal(await ending, true);
    assert.deepEqual([endsBeforePrompt, process.ends], [0, 1]);
    await session.disposeAsync();
  });

  it("ends a shell typed a line before its first prompt only once it draws the next one, since readline takes the line at that prompt", async () => {
    vi.useFakeTimers();
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createSession(process, new SessionRecorder(), new TerminalSize(80, 24), null, "n1");
    session.write("echo $((20 + 22))\r");
    process.emitData("echo $((20 + 22))\r\n\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007echo $((20 + 22))\r\n\u001b[?2004l\r");

    const ending: Promise<boolean> = session.endAsync();
    await vi.advanceTimersByTimeAsync(499);
    const endsBeforePrompt: number = process.ends;
    process.emitData("\u001b]6973;C;n1\u000742\r\n\u001b]6973;D;n1;0\u0007\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007");

    assert.equal(await ending, true);
    assert.deepEqual([endsBeforePrompt, process.ends], [0, 1]);
    await session.disposeAsync();
  });

  it("ends a shell typed a line while a command ran only once it draws the prompt after that line's", async () => {
    vi.useFakeTimers();
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createSession(process, new SessionRecorder(), new TerminalSize(80, 24), null, "n1");
    process.emitData("\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007");
    session.write("sleep 1\r");
    process.emitData("sleep 1\r\n\u001b[?2004l\r\u001b]6973;C;n1\u0007");
    session.write("echo $((20 + 22))\r");
    process.emitData("echo $((20 + 22))\r\n\u001b]6973;D;n1;0\u0007\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007echo $((20 + 22))\r\n\u001b[?2004l\r");

    const ending: Promise<boolean> = session.endAsync();
    await vi.advanceTimersByTimeAsync(499);
    const endsBeforePrompt: number = process.ends;
    process.emitData("\u001b]6973;C;n1\u000742\r\n\u001b]6973;D;n1;0\u0007\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007");

    assert.equal(await ending, true);
    assert.deepEqual([endsBeforePrompt, process.ends], [0, 1]);
    await session.disposeAsync();
  });

  it("ends a shell that doesn't draw its prompt within 500 ms, and one waiting at its prompt, pasted lines without an Enter, or without marks at once", async () => {
    vi.useFakeTimers();
    const busy: FakePtyProcess = new FakePtyProcess();
    const busySession: TerminalSession = createSession(busy, new SessionRecorder(), new TerminalSize(80, 24), null, "n1");
    busy.emitData("\u001b]6973;C;n1\u0007");
    const entered: FakePtyProcess = new FakePtyProcess();
    const enteredSession: TerminalSession = createSession(entered, new SessionRecorder(), new TerminalSize(80, 24), null, "n1");
    entered.emitData("\u001b]6973;B;n1\u0007");
    enteredSession.write("exec sleep 600\r");
    const idle: FakePtyProcess = new FakePtyProcess();
    const idleSession: TerminalSession = createSession(idle, new SessionRecorder(), new TerminalSize(80, 24), null, "n1");
    idle.emitData("\u001b]6973;B;n1\u0007");
    idleSession.write("sleep 600");
    const pasted: FakePtyProcess = new FakePtyProcess();
    const pastedSession: TerminalSession = createSession(pasted, new SessionRecorder(), new TerminalSize(80, 24), null, "n1");
    pasted.emitData("\u001b]6973;B;n1\u0007");
    pastedSession.write("\u001b[200~sleep 1\rsleep 2\r\n\u001b[201~");
    const plain: FakePtyProcess = new FakePtyProcess();
    const plainSession: TerminalSession = createSession(plain, new SessionRecorder());

    const endings: Promise<boolean[]> = Promise.all([busySession.endAsync(), enteredSession.endAsync()]);
    await Promise.all([idleSession.endAsync(), pastedSession.endAsync(), plainSession.endAsync()]);
    await vi.advanceTimersByTimeAsync(499);
    const endsBeforeLimit: number[] = [busy.ends, entered.ends];
    await vi.advanceTimersByTimeAsync(1);

    assert.deepEqual(await endings, [true, true]);
    assert.deepEqual([endsBeforeLimit, busy.ends, entered.ends, idle.ends, pasted.ends, plain.ends], [[0, 0], 1, 1, 1, 1, 1]);
    await Promise.all([busySession.disposeAsync(), enteredSession.disposeAsync(), idleSession.disposeAsync(), pastedSession.disposeAsync(),
      plainSession.disposeAsync()]);
  });

  it("stops waiting for the prompt of a shell that exits while it is being ended", async () => {
    vi.useFakeTimers();
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createSession(process, recorder, new TerminalSize(80, 24), null, "n1");
    process.emitData("\u001b]6973;C;n1\u0007");

    const ending: Promise<boolean> = session.endAsync();
    process.exit(0);

    assert.equal(await ending, true);
    assert.deepEqual(recorder.exits.map(t => t.exit.endedBy), ["Close"]);
    await session.disposeAsync();
  });

  it("doesn't pause a shell it is ending when the shell's last output crosses 1 MiB, so the exit comes at once", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    process.isEndable = false;
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createSession(process, recorder);
    await session.attachAsync("p1", []);

    await session.endAsync();
    process.emitData("\r".repeat(MEBIBYTE + 1));
    process.exit(0);

    assert.deepEqual([process.pauses, recorder.exits.map(t => t.exit.endedBy)], [0, ["Close"]]);
    session.detach("p1");
    await session.disposeAsync();
  });

  it("writes input and resizes once per new size", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createSession(process, new SessionRecorder());

    session.write("ls\r");
    session.resize(new TerminalSize(80, 24));
    session.resize(new TerminalSize(120, 40));

    assert.deepEqual(process.writes, ["ls\r"]);
    assert.deepEqual(process.sizes, ["120x40"]);
    await session.disposeAsync();
  });

  it("attaches a pane with a snapshot and makes the shell redraw", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createSession(process, new SessionRecorder(), new TerminalSize(80, 24), new WindowsPty(26_100));

    process.emitData("prompt$ \u001b[3");
    const attachment: TerminalAttachment = await session.attachAsync("p1", []);

    assert.match(attachment.snapshot, /prompt\$/u);
    assert.equal(attachment.pending, "\u001b[3");
    assert.equal(attachment.offset, 11);
    assert.deepEqual(attachment.size.toJson(), { cols: 80, rows: 24 });
    assert.equal(attachment.exit, null);
    assert.equal(attachment.windowsPty?.buildNumber, 26_100);
    assert.deepEqual(process.sizes, ["80x23", "80x24"]);
    await session.disposeAsync();
  });

  it("attaches a one-row terminal without a redraw", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createSession(process, new SessionRecorder(), new TerminalSize(80, 1));

    await session.attachAsync("p1", []);

    assert.deepEqual(process.sizes, []);
    await session.disposeAsync();
  });

  it("attaches to an ended terminal without a redraw", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createSession(process, new SessionRecorder());

    process.exit(0);
    const attachment: TerminalAttachment = await session.attachAsync("p1", []);

    assert.equal(attachment.exit?.exitCode, 0);
    assert.deepEqual(process.sizes, []);
    await session.disposeAsync();
  });

  it("pauses the shell for a visible pane that falls behind, and resumes when it catches up or hides", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createSession(process, new SessionRecorder());

    await session.attachAsync("p1", []);
    process.emitData("\r".repeat(MEBIBYTE + 1));
    assert.equal(process.pauses, 1);
    session.acknowledge("p1", MEBIBYTE + 1);
    await vi.waitFor(() => assert.equal(process.resumes, 1));
    process.emitData("\r".repeat(MEBIBYTE + 1));
    assert.equal(process.pauses, 2);
    session.setVisible("p1", false);
    await vi.waitFor(() => assert.equal(process.resumes, 2));
    session.detach("p1");
    await session.disposeAsync();
  });

  it("restarts below the old screen with the program's modes cleared, and takes typing only from the new shell", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createSession(process, recorder, new TerminalSize(80, 3));
    const modes: readonly string[] = ["\u001b[?1h", "\u001b[?1000h", "\u001b[?2004h", "\u001b[?1049h"];
    process.emitData("old output\r\n");
    process.emitData(modes.join("") + "in the program");
    const before: TerminalAttachment = await session.attachAsync("p1", []);
    process.exit(1);
    session.write("ignored\r");
    const next: FakePtyProcess = new FakePtyProcess(4_243);

    session.restart(next, null, new TerminalSize(80, 4));
    process.emitData("from the old shell");
    next.emitData("new prompt$ ");
    session.write("ls\r");
    await vi.waitFor(() => assert.match(recorder.text, /new prompt\$ $/u));
    const after: TerminalAttachment = await session.attachAsync("p2", []);

    assert.deepEqual(modes.map(t => before.snapshot.includes(t)), [true, true, true, true]);
    assert.deepEqual(modes.map(t => after.snapshot.includes(t)), [false, false, false, false]);
    assert.ok(after.snapshot.indexOf("old output") < after.snapshot.indexOf("new prompt$"));
    assert.equal(recorder.text, `old output\r\n${modes.join("")}in the program\u001b[?1047l\u001b[!p\u001b[?1000l\u001b[?1002l\u001b[?1003l\u001b[?1006l\u001b[?2004l\r\n\n\n\n\u001b[Hnew prompt$ `);
    assert.deepEqual([after.size.columns, after.size.rows], [80, 4]);
    assert.equal(after.offset, recorder.text.length);
    assert.equal(after.exit, null);
    assert.equal(session.hasExited, false);
    assert.equal(session.pid, 4_243);
    assert.deepEqual([process.writes, next.writes], [[], ["ls\r"]]);
    assert.equal(recorder.exits.length, 1);
    next.exit(0);
    assert.deepEqual(recorder.exits.map(t => t.exit.exitCode), [1, 0]);
    await session.disposeAsync();
  });

  it("keeps its panes across a restart, and starts the new shell paused while one is still behind", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createSession(process, new SessionRecorder());
    await session.attachAsync("p1", []);
    process.emitData("\r".repeat(MEBIBYTE + 1));
    process.exit(0);
    const next: FakePtyProcess = new FakePtyProcess(4_243);

    session.restart(next, null, new TerminalSize(80, 24));
    assert.equal(next.pauses, 1);
    session.acknowledge("p1", MEBIBYTE + 1 + 2_000);
    await vi.waitFor(() => assert.equal(next.resumes, 1));
    next.emitData("\r".repeat(MEBIBYTE + 1));

    assert.equal(next.pauses, 2);
    assert.deepEqual([process.pauses, process.resumes], [1, 0]);
    await session.disposeAsync();
  });

  it("tracks a pane that attached while ended once its shell restarts", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createSession(process, new SessionRecorder());
    process.exit(0);
    await session.attachAsync("p1", []);
    const next: FakePtyProcess = new FakePtyProcess(4_243);

    session.restart(next, null, new TerminalSize(80, 24));
    next.emitData("\r".repeat(MEBIBYTE + 1));
    await session.attachAsync("p2", []);

    assert.deepEqual([next.pauses, next.resumes], [1, 0]);
    await session.disposeAsync();
  });

  it("starts tracking commands afresh with the new shell's integration", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createSession(process, new SessionRecorder(), new TerminalSize(80, 24), null, "n1");
    process.emitData("\u001b]6973;C;n1\u0007");
    process.exit(0);
    assert.equal(session.commands.hasMarks, true);

    session.restart(new FakePtyProcess(4_243), null, new TerminalSize(80, 24));

    assert.deepEqual([session.commands.hasMarks, session.commands.runningCommand, session.hasIntegration], [false, null, false]);
    await session.disposeAsync();
  });

  it("anchors the line where each prompt started, once the output before its mark is parsed, a run's start there, and disposes it when the next prompt starts or the shell restarts", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createSession(process, new SessionRecorder(), new TerminalSize(80, 24), null, "n1");
    process.emitData("welcome\r\n");
    const beforePrompt: Promise<MirrorLine> | null = session.promptLine;

    process.emitData("motd\r\n\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007ls\r\nfile\r\n");
    const first: MirrorLine | null = await session.promptLine;
    process.emitData("\u001b]6973;A;n1\u0007$ ");
    const second: MirrorLine | null = await session.promptLine;
    await vi.waitFor(() => assert.equal(first?.index, null));
    const run: MirrorLine = await session.anchorRunAsync();
    const lines: readonly string[] = first === null ? [] : (await session.readRunLinesAsync(first, second, 10)).lines.map(t => t.text);
    process.exit(0);
    session.restart(new FakePtyProcess(4_243), null, new TerminalSize(80, 24));
    await vi.waitFor(() => assert.equal(second?.index, null));

    assert.deepEqual([beforePrompt, first?.number, second?.number, run.number, run.index, session.promptLine], [null, 2, 4, 4, 4, null]);
    assert.deepEqual(lines, ["$ ls", "file"]);
    await session.disposeAsync();
  });

  it("keeps a marker on a run's start anchored at a prompt whose next prompt starts before the mirror parses up to the run's start", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createSession(process, new SessionRecorder(), new TerminalSize(80, 24), null, "n1");
    process.emitData("motd\r\n\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007");
    await session.promptLine;

    const starting: Promise<MirrorLine> = session.anchorRunAsync();
    process.emitData("ls\r\n\u001b]6973;A;n1\u0007$ ");
    const run: MirrorLine = await starting;

    assert.deepEqual([run.number, run.index], [1, 1]);
    await session.disposeAsync();
  });

  it("detaches a pane that stays over 1 MiB behind for 10 seconds", async () => {
    vi.useFakeTimers();
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createSession(process, recorder);

    const attaching: Promise<TerminalAttachment> = session.attachAsync("p1", []);
    await vi.advanceTimersByTimeAsync(0);
    await attaching;
    process.emitData("\r".repeat(MEBIBYTE + 1));
    await vi.advanceTimersByTimeAsync(10_000);

    assert.deepEqual(recorder.detached.map(t => t.toJson()), [{ sessionId: "s1", paneId: "p1" }]);
    await session.disposeAsync();
  });

  it("stores no lines without a history folder, names an empty range, and refuses to read them", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = new TerminalSession("s1", "bash", new TerminalSize(20, 5), process, null, null, null,
      ProtocolResources.defaultStoredLimit, recorder, Resources.maximumAgentTextLength, TerminalShellKind.Other, false);

    process.emitData(Array.from({ length: 1_010 }, (_t, index) => `line ${index}\r\n`).join(""));
    const attachment: TerminalAttachment = await session.attachAsync("p1", []);
    const reading: Promise<TerminalLinePage> = session.readLinesAsync(0, 500);

    await assert.rejects(reading, StoredLinesUnwritableException);
    assert.deepEqual(attachment.stored.toJson(), { start: 0, end: 0, dropped: 0 });
    await session.disposeAsync();
  });

  describe("with stored lines", () => {
    let folder: string = "";
    let paths: TerminalHistoryPaths = new TerminalHistoryPaths("", "");

    beforeEach(async () => {
      folder = await mkdtemp(join(tmpdir(), "terminal-session-"));
      paths = new TerminalHistoryPaths(join(folder, "s1-1.jsonl"), join(folder, "s1-2.jsonl"));
    });

    afterEach(async () => {
      await rm(folder, { recursive: true, force: true });
    });

    function createStoring(process: FakePtyProcess, recorder: SessionRecorder): TerminalSession {
      return new TerminalSession("s1", "bash", new TerminalSize(20, 5), process, null, null, paths, ProtocolResources.defaultStoredLimit, recorder,
        Resources.maximumAgentTextLength, TerminalShellKind.Other, false);
    }

    it("stores the lines that leave its scrollback, names their range in its output and attachments, and removes their files when disposed", async () => {
      const process: FakePtyProcess = new FakePtyProcess();
      const recorder: SessionRecorder = new SessionRecorder();
      const session: TerminalSession = createStoring(process, recorder);

      process.emitData(Array.from({ length: 1_010 }, (_t, index) => `line ${index}\r\n`).join(""));
      const attachment: TerminalAttachment = await session.attachAsync("p1", []);
      const page: TerminalLinePage = await session.readLinesAsync(0, 500);
      process.emitData("$ ");
      await vi.waitFor(() => assert.equal(recorder.text.endsWith("$ "), true));
      const stored: boolean = existsSync(paths.first);
      await session.disposeAsync();

      assert.deepEqual(attachment.stored.toJson(), { start: 0, end: 6, dropped: 0 });
      assert.deepEqual(page.lines.map(t => t.text), ["line 0", "line 1", "line 2", "line 3", "line 4", "line 5"]);
      assert.deepEqual(recorder.outputs.at(-1)?.stored.toJson(), { start: 0, end: 6, dropped: 0 });
      assert.deepEqual([stored, existsSync(paths.first), existsSync(paths.second)], [true, false, false]);
    });

    it("keeps its stored lines when its shell restarts, and stores the old screen as it scrolls away", async () => {
      const process: FakePtyProcess = new FakePtyProcess();
      const session: TerminalSession = createStoring(process, new SessionRecorder());
      process.emitData(Array.from({ length: 1_010 }, (_t, index) => `line ${index}\r\n`).join(""));
      process.exit(0);

      session.restart(new FakePtyProcess(4_243), null, new TerminalSize(20, 5));
      await session.attachAsync("p1", []);
      const page: TerminalLinePage = await session.readLinesAsync(0, 500);

      assert.deepEqual(page.lines.slice(0, 11).map(t => t.text), Array.from({ length: 11 }, (_t, index) => `line ${index}`));
      await session.disposeAsync();
    });
  });
});

describe("TerminalSession resized at a Windows bash prompt", () => {
  const PROMPT: string = "\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007";
  const STALL: string = "\u001b[6n\u001b[24;3H";

  function createWindowsBash(process: FakePtyProcess, shellKind: TerminalShellKind = TerminalShellKind.Bash,
    windowsPty: WindowsPty | null = new WindowsPty(26_100)): TerminalSession {
    return createSession(process, new SessionRecorder(), new TerminalSize(80, 24), windowsPty, "n1", shellKind);
  }

  function bellsOf(process: FakePtyProcess): readonly string[] {
    return process.writes.filter(t => t === "\u0007");
  }

  function keysOf(writes: readonly string[]): readonly string[] {
    return writes.filter(t => !/^\u001b\[\d+;\d+R$/u.test(t));
  }

  it("sends the shell no Ctrl+G and holds no timer when the output after the resize stops at the cursor request and move and no key comes", async () => {
    vi.useFakeTimers();
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createWindowsBash(process);
    process.emitData(PROMPT);

    assert.equal(session.resize(new TerminalSize(100, 24)), true);
    process.emitData(STALL);
    await vi.advanceTimersByTimeAsync(60_000);

    assert.deepEqual([bellsOf(process), vi.getTimerCount()], [[], 0]);
    vi.useRealTimers();
    await session.disposeAsync();
  });

  it("types a command whole after a resize Git Bash took without a redraw, which leaves it waiting on its cursor request, sending one Ctrl+G ahead of it", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createWindowsBash(process);
    process.emitData(PROMPT);
    session.resize(new TerminalSize(120, 30));
    process.emitData("\u001b[6n");
    process.emitData("\u001b[1;3H");
    const before: number = process.writes.length;

    session.write("echo probe-ok\r");
    process.emitData("\r\u001b[K\r$ ");
    session.write("echo again\r");

    await vi.waitFor(() => assert.deepEqual(keysOf(process.writes.slice(before)), ["\u0007", "echo probe-ok\r", "echo again\r"]));
    await session.disposeAsync();
  });

  it("sends it ahead of the next key after a pane's attach, whose redraw resizes the shell too", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const session: TerminalSession = createWindowsBash(process);
    process.emitData(PROMPT);
    await session.attachAsync("p1", []);

    process.emitData(STALL);
    session.write("e");

    await vi.waitFor(() => assert.deepEqual(process.writes.slice(-2), ["\u0007", "e"]));
    await session.disposeAsync();
  });

  it("sends nothing when the shell redraws its prompt before the key, or the person types before the output stops", async () => {
    const redrawn: FakePtyProcess = new FakePtyProcess();
    const redrawnSession: TerminalSession = createWindowsBash(redrawn);
    const typed: FakePtyProcess = new FakePtyProcess();
    const typedSession: TerminalSession = createWindowsBash(typed);
    redrawn.emitData(PROMPT);
    typed.emitData(PROMPT);

    redrawnSession.resize(new TerminalSize(100, 24));
    typedSession.resize(new TerminalSize(100, 24));
    redrawn.emitData(STALL);
    typedSession.write("e");
    typed.emitData(STALL);
    redrawn.emitData(PROMPT);
    redrawnSession.write("e");
    typedSession.write("c");

    await vi.waitFor(() => assert.deepEqual([keysOf(redrawn.writes), keysOf(typed.writes)], [["e"], ["e", "c"]]));
    assert.deepEqual([bellsOf(redrawn), bellsOf(typed)], [[], []]);
    await redrawnSession.disposeAsync();
    await typedSession.disposeAsync();
  });

  it("sends nothing when, before the key, the shell is resized again, exits, restarts or the session is disposed", async () => {
    const resized: FakePtyProcess = new FakePtyProcess();
    const resizedSession: TerminalSession = createWindowsBash(resized);
    const exited: FakePtyProcess = new FakePtyProcess();
    const exitedSession: TerminalSession = createWindowsBash(exited);
    const restarted: FakePtyProcess = new FakePtyProcess();
    const restartedSession: TerminalSession = createWindowsBash(restarted);
    for (const process of [resized, exited, restarted])
      process.emitData(PROMPT);
    for (const session of [resizedSession, exitedSession, restartedSession])
      session.resize(new TerminalSize(100, 24));
    for (const process of [resized, exited, restarted])
      process.emitData(STALL);

    resizedSession.resize(new TerminalSize(120, 24));
    exited.exit(0);
    const replacement: FakePtyProcess = new FakePtyProcess();
    restartedSession.restart(replacement, "n2", new TerminalSize(100, 24));
    for (const session of [resizedSession, exitedSession, restartedSession])
      session.write("e");

    assert.deepEqual([resized, exited, restarted, replacement].map(t => bellsOf(t)), [[], [], [], []]);
    for (const session of [resizedSession, exitedSession, restartedSession])
      await session.disposeAsync();
  });

  it("sends nothing to another shell on Windows, to bash elsewhere, or while a command runs", async () => {
    const powerShell: FakePtyProcess = new FakePtyProcess();
    const powerShellSession: TerminalSession = createWindowsBash(powerShell, TerminalShellKind.PowerShell);
    const posix: FakePtyProcess = new FakePtyProcess();
    const posixSession: TerminalSession = createWindowsBash(posix, TerminalShellKind.Bash, null);
    const running: FakePtyProcess = new FakePtyProcess();
    const runningSession: TerminalSession = createWindowsBash(running);
    powerShell.emitData(PROMPT);
    posix.emitData(PROMPT);
    running.emitData(PROMPT);
    runningSession.write("sleep 9\r");
    running.emitData("sleep 9\r\n\u001b]6973;C;n1\u0007");

    for (const session of [powerShellSession, posixSession, runningSession])
      session.resize(new TerminalSize(100, 24));
    for (const process of [powerShell, posix, running])
      process.emitData(STALL);
    for (const session of [powerShellSession, posixSession, runningSession])
      session.write("e");

    assert.deepEqual([bellsOf(powerShell), bellsOf(posix), bellsOf(running)], [[], [], []]);
    for (const session of [powerShellSession, posixSession, runningSession])
      await session.disposeAsync();
  });
});

describe("TerminalSession marking the shell's line", () => {
  const PROMPT: string = "\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007";
  const COMMAND_START: string = "\u001b]6973;C;n1\u0007";

  function createMarking(process: FakePtyProcess, recorder: SessionRecorder, marksInput: boolean, size: TerminalSize = new TerminalSize(80, 24)): TerminalSession {
    return new TerminalSession("s1", "bash", size, process, "n1", null, null, ProtocolResources.defaultStoredLimit, recorder,
      Resources.maximumAgentTextLength, TerminalShellKind.Bash, marksInput);
  }

  function inputsOf(recorder: SessionRecorder): readonly string[] {
    return recorder.outputs.flatMap(t => t.inputs.map(input => `${input.edge}@${input.offset}`));
  }

  it("marks where the line starts and ends in its output, and reads each command a person started", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createMarking(process, recorder, true);

    process.emitData(PROMPT);
    process.emitData("ls -la");
    process.emitData(`\r\n${COMMAND_START}out\r\n\u001b]6973;D;n1;0\u0007`);
    await vi.waitFor(() => assert.equal(recorder.commands.length, 1));
    await vi.waitFor(() => assert.equal(recorder.text.length, 65));

    assert.deepEqual(inputsOf(recorder), ["End@12", "Start@26", "End@46", "End@65"]);
    assert.deepEqual(recorder.commands, ["ls -la"]);
    await session.disposeAsync();
  });

  it("tells its listener, with the reason, a started command its listener could not keep", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: RefusingRecorder = new RefusingRecorder();
    const session: TerminalSession = createMarking(process, recorder, true);
    const failure: Promise<string> = recorder.nextFailureAsync();

    process.emitData(PROMPT);
    process.emitData("ls -la");
    process.emitData(`\r\n${COMMAND_START}`);

    assert.equal(await failure, "s1: The commands are full.");
    assert.deepEqual(recorder.refused, ["ls -la"]);
    await session.disposeAsync();
  });

  it("marks where a command over several lines goes on after the continuation prompt the shell marked", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createMarking(process, recorder, true);

    process.emitData(PROMPT);
    process.emitData("echo 'a\r\n> \u001b]6973;F;n1\u0007b'");
    await vi.waitFor(() => assert.equal(recorder.text.length, 51));

    assert.deepEqual(inputsOf(recorder), ["End@12", "Start@26", "Continuation@49"]);
    await session.disposeAsync();
  });

  it("reads a command wrapped over rows whole, a command over several lines by its first, and none for an empty line or one starting with a space", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createMarking(process, recorder, true, new TerminalSize(20, 6));

    process.emitData(`${PROMPT}echo ${"a".repeat(25)}\r\n${COMMAND_START}`);
    process.emitData(`${PROMPT}echo one \\\r\n> two\r\n${COMMAND_START}`);
    process.emitData(`${PROMPT}   \r\n${COMMAND_START}`);
    process.emitData(`${PROMPT} export TOKEN=x\r\n${COMMAND_START}`);
    process.emitData(`${PROMPT}pwd\r\n${COMMAND_START}`);
    await vi.waitFor(() => assert.equal(recorder.commands.at(-1), "pwd"));

    assert.deepEqual(recorder.commands, [`echo ${"a".repeat(25)}`, "echo one \\", "pwd"]);
    await session.disposeAsync();
  });

  it("keeps the command the shell gave in its mark, by its first line, so a right prompt the line keeps isn't part of it, and the screen's line for a mark without one", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createMarking(process, recorder, true, new TerminalSize(40, 6));

    process.emitData(`${PROMPT}git status\u001b[30G~/repo 10:42\r\n\u001b]6973;C;n1;Cmd=git status\u0007`);
    process.emitData(`${PROMPT}echo one \\\r\n> two\r\n\u001b]6973;C;n1;Cmd=echo one \\x5c\\x0atwo\u0007`);
    process.emitData(`${PROMPT} export TOKEN=x\r\n\u001b]6973;C;n1;Cmd= export TOKEN=x\u0007`);
    process.emitData(`${PROMPT}pwd\r\n\u001b]6973;C;n1;Cmd=\u0007`);
    await vi.waitFor(() => assert.equal(recorder.commands.at(-1), "pwd"));

    assert.deepEqual(recorder.commands, ["git status", "echo one \\", "pwd"]);
    await session.disposeAsync();
  });

  it("reads the line without the right prompt the shell marked on its row when the mark gives no command, and the whole row once typed text reaches it", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createMarking(process, recorder, true, new TerminalSize(40, 6));
    const rightPrompt: string = "\u001b[30G\u001b]6973;R;n1\u0007~/repo\u001b[3G";

    process.emitData(`${PROMPT}${rightPrompt}ls -la\r\n\u001b]6973;C;n1;Cmd=\u0007`);
    process.emitData(`${PROMPT}${rightPrompt}echo ${"x".repeat(30)}\r\n${COMMAND_START}`);
    await vi.waitFor(() => assert.equal(recorder.commands.length, 2));

    assert.deepEqual(recorder.commands, ["ls -la", `echo ${"x".repeat(30)}`]);
    await session.disposeAsync();
  });

  it("attaches with the column the shell marked a right prompt at on the line's row, and none for a prompt without one", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createMarking(process, recorder, true, new TerminalSize(40, 6));

    process.emitData(`\u001b]6973;R;n1\u0007top\r\n${PROMPT}\u001b[30G\u001b]6973;R;n1\u0007~/repo\u001b[3Ggit`);
    await vi.waitFor(() => assert.equal(inputsOf(recorder).filter(t => t.startsWith("RightPrompt@")).length, 2));
    const marked: TerminalAttachment = await session.attachAsync("p1", []);
    process.emitData(`\r\n${COMMAND_START}${PROMPT}`);
    const unmarked: TerminalAttachment = await session.attachAsync("p2", []);

    assert.deepEqual([marked.input?.toJson(), unmarked.input?.toJson()], [{ rowsAbove: 0, column: 2, rightPrompt: 29 }, { rowsAbove: 0, column: 2, rightPrompt: null }]);
    await session.disposeAsync();
  });

  it("reads the line from where a prompt that redraws itself in place starts it again", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createMarking(process, recorder, true);

    process.emitData(`${PROMPT}gi`);
    process.emitData(`\r\u001b[K\u001b]6973;A;n1\u0007main $ \u001b]6973;B;n1\u0007git status\r\n${COMMAND_START}`);
    await vi.waitFor(() => assert.equal(recorder.commands.length, 1));

    assert.deepEqual(recorder.commands, ["git status"]);
    await session.disposeAsync();
  });

  it("attaches with where the line starts and the shell's commands at a prompt, and with neither once the shell left it", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createMarking(process, recorder, true);

    process.emitData(`top\r\n${PROMPT}ls`);
    const atPrompt: TerminalAttachment = await session.attachAsync("p1", ["ls -la"]);
    process.emitData(`\r\n${COMMAND_START}`);
    const running: TerminalAttachment = await session.attachAsync("p2", ["ls", "ls -la"]);

    assert.deepEqual(atPrompt.input?.toJson(), { rowsAbove: 0, column: 2, rightPrompt: null });
    assert.deepEqual(atPrompt.commands, ["ls -la"]);
    assert.equal(running.input, null);
    assert.deepEqual(running.commands, ["ls", "ls -la"]);
    await session.disposeAsync();
  });

  it("ends the line when the shell restarts", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createMarking(process, recorder, true);
    process.emitData(`${PROMPT}ls`);
    process.exit(0);

    session.restart(new FakePtyProcess(4_243), "n2", new TerminalSize(80, 24));
    const attachment: TerminalAttachment = await session.attachAsync("p1", []);
    await vi.waitFor(() => assert.equal(inputsOf(recorder).length, 3));

    assert.deepEqual(inputsOf(recorder).map(t => t.split("@")[0]), ["End", "Start", "End"]);
    assert.equal(attachment.input, null);
    assert.deepEqual(recorder.commands, []);
    await session.disposeAsync();
  });

  it("marks no line and reads no command for an agent's terminal", async () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const recorder: SessionRecorder = new SessionRecorder();
    const session: TerminalSession = createMarking(process, recorder, false);

    process.emitData(`${PROMPT}ls`);
    const atPrompt: TerminalAttachment = await session.attachAsync("p1", ["ls -la"]);
    process.emitData(`\r\n${COMMAND_START}out\r\n`);
    await session.attachAsync("p2", []);
    await vi.waitFor(() => assert.match(recorder.text, /out\r\n$/u));

    assert.deepEqual(inputsOf(recorder), []);
    assert.deepEqual([atPrompt.input, atPrompt.commands], [null, []]);
    assert.deepEqual(recorder.commands, []);
    await session.disposeAsync();
  });

  describe("asking the shell's own completers for the command's options", () => {
    const KEYS: string = "\u001b[24;7~";
    const BOUND_PROMPT: string = "\u001b]6973;P;n1;Options=1\u0007\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007";

    function createBoundSession(process: FakePtyProcess): TerminalSession {
      const session: TerminalSession = createSession(process, new SessionRecorder(), new TerminalSize(80, 24), null,"n1", TerminalShellKind.Bash);
      process.emitData(BOUND_PROMPT);
      return session;
    }

    it("sends the binding's keys at the prompt and takes the options mark that answers them, which the panes' line never ends at", async () => {
      const process: FakePtyProcess = new FakePtyProcess();
      const recorder: SessionRecorder = new SessionRecorder();
      const session: TerminalSession = createSession(process, recorder, new TerminalSize(80, 24), null,"n1", TerminalShellKind.Bash);
      process.emitData(BOUND_PROMPT);

      const reply: Promise<ShellOptionsReply> = session.askOptionsAsync(KEYS);
      process.emitData("\u001b]6973;O;n1;--all;--a\\x3bb\u0007");
      const answered: ShellOptionsReply = await reply;

      assert.deepEqual([answered.options, answered.isTimedOut, process.writes], [["--all", "--a;b"], false, [KEYS]]);
      assert.equal(session.commands.isWaitingAtPrompt, true);
      await session.disposeAsync();
    });

    it("asks nothing before a prompt says the binding is in place, after one says it isn't, while a command runs, or without the integration", async () => {
      const unmarked: FakePtyProcess = new FakePtyProcess();
      const plain: TerminalSession = createSession(unmarked, new SessionRecorder(), new TerminalSize(80, 24), null,null, TerminalShellKind.Bash);
      const process: FakePtyProcess = new FakePtyProcess();
      const session: TerminalSession = createSession(process, new SessionRecorder(), new TerminalSize(80, 24), null,"n1", TerminalShellKind.Bash);
      process.emitData("\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007");
      const beforeBinding: ShellOptionsReply = await session.askOptionsAsync(KEYS);
      process.emitData(BOUND_PROMPT + "\u001b]6973;C;n1\u0007");
      const running: ShellOptionsReply = await session.askOptionsAsync(KEYS);
      process.emitData("\u001b]6973;D;n1;0\u0007\u001b]6973;P;n1;Options=0\u0007\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007");
      const unbound: ShellOptionsReply = await session.askOptionsAsync(KEYS);

      assert.deepEqual([beforeBinding, running, unbound, await plain.askOptionsAsync(KEYS)], [
        ShellOptionsReply.none, ShellOptionsReply.none, ShellOptionsReply.none, ShellOptionsReply.none]);
      assert.deepEqual([process.writes, unmarked.writes], [[], []]);
      await Promise.all([session.disposeAsync(), plain.disposeAsync()]);
    });

    it("ends a request without options when the person types, not at a pane's reply, and drops its answer when it comes", async () => {
      const process: FakePtyProcess = new FakePtyProcess();
      const session: TerminalSession = createBoundSession(process);

      const repliedOver: Promise<ShellOptionsReply> = session.askOptionsAsync(KEYS);
      session.write("\u001b[I", false);
      process.emitData("\u001b]6973;O;n1;--kept\u0007");
      const kept: ShellOptionsReply = await repliedOver;
      const typedOver: Promise<ShellOptionsReply> = session.askOptionsAsync(KEYS);
      session.write("a");
      const cancelled: ShellOptionsReply = await typedOver;
      const next: Promise<ShellOptionsReply> = session.askOptionsAsync(KEYS);
      process.emitData("\u001b]6973;O;n1;--late\u0007\u001b]6973;O;n1;--next\u0007");

      assert.deepEqual([kept.options, cancelled, (await next).options], [["--kept"], ShellOptionsReply.none, ["--next"]]);
      await session.disposeAsync();
    });

    it("keeps a request waiting while the shell redraws its prompt in place, as zsh can before it answers, and takes the answer", async () => {
      const process: FakePtyProcess = new FakePtyProcess();
      const session: TerminalSession = createBoundSession(process);
      process.emitData("ls\r\n\u001b]6973;C;n1\u0007\u001b]6973;P;n1;Cwd=/work\u0007\u001b]6973;D;n1;0\u0007\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007git -");
      const redraw: string = "\r\r\u001b[J\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007git -";

      const reply: Promise<ShellOptionsReply> = session.askOptionsAsync(KEYS);
      process.emitData(`${redraw}${redraw}\u001b]6973;O;n1;--all\u0007`);

      assert.deepEqual((await reply).options, ["--all"]);
      await session.disposeAsync();
    });

    it("ends a request waiting at a new prompt with no command's end, as zsh's after Ctrl+C or an empty line, so a later request gets its own answer", async () => {
      const process: FakePtyProcess = new FakePtyProcess();
      const session: TerminalSession = createBoundSession(process);
      process.emitData("git -");

      const interrupted: Promise<ShellOptionsReply> = session.askOptionsAsync(KEYS);
      process.emitData("^C\r\n\u001b]6973;P;n1;Cwd=/work\u0007\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007git -");
      const ended: ShellOptionsReply = await interrupted;
      const later: Promise<ShellOptionsReply> = session.askOptionsAsync(KEYS);
      process.emitData("\u001b]6973;O;n1;--all\u0007");

      assert.deepEqual([ended, (await later).options], [ShellOptionsReply.none, ["--all"]]);
      await session.disposeAsync();
    });

    it("ends the requests waiting at a new prompt after a command's end or when a command starts, and drops an answer no request waits for", async () => {
      const process: FakePtyProcess = new FakePtyProcess();
      const session: TerminalSession = createBoundSession(process);

      process.emitData("\u001b]6973;O;n1;--unasked\u0007");
      const endedOver: Promise<ShellOptionsReply> = session.askOptionsAsync(KEYS);
      process.emitData("\r\n\u001b]6973;D;n1;0\u0007\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007");
      const reprompted: ShellOptionsReply = await endedOver;
      const startedOver: Promise<ShellOptionsReply> = session.askOptionsAsync(KEYS);
      process.emitData("\r\n\u001b]6973;C;n1\u0007");
      const started: ShellOptionsReply = await startedOver;
      process.emitData("\u001b]6973;D;n1;0\u0007\u001b]6973;A;n1\u0007$ \u001b]6973;B;n1\u0007");
      const answered: Promise<ShellOptionsReply> = session.askOptionsAsync(KEYS);
      process.emitData("\u001b]6973;O;n1;--all\u0007");

      assert.deepEqual([reprompted, started, (await answered).options], [ShellOptionsReply.none, ShellOptionsReply.none, ["--all"]]);
      await session.disposeAsync();
    });

    it("gives the shell a plain Tab when no answer comes in time, and drops the late answer", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const process: FakePtyProcess = new FakePtyProcess();
      const session: TerminalSession = createBoundSession(process);
      const first: Promise<ShellOptionsReply> = session.askOptionsAsync(KEYS);
      process.emitData("\u001b]6973;O;n1;--first\u0007");
      await first;

      const late: Promise<ShellOptionsReply> = session.askOptionsAsync(KEYS);
      vi.advanceTimersByTime(499);
      const writesBefore: readonly string[] = [...process.writes];
      vi.advanceTimersByTime(1);
      const timedOut: ShellOptionsReply = await late;
      const next: Promise<ShellOptionsReply> = session.askOptionsAsync(KEYS);
      process.emitData("\u001b]6973;O;n1;--late\u0007\u001b]6973;O;n1;--next\u0007");

      assert.deepEqual([writesBefore, timedOut, (await next).options, process.writes],
        [[KEYS, KEYS], ShellOptionsReply.timedOut, ["--next"], [KEYS, KEYS, "\t", KEYS]]);
      await session.disposeAsync();
    });

    it("waits 2 seconds for a shell's first answer, as a fresh Windows PowerShell loads its completion on first use, and again after a restart", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const process: FakePtyProcess = new FakePtyProcess();
      const session: TerminalSession = createBoundSession(process);

      const slow: Promise<ShellOptionsReply> = session.askOptionsAsync(KEYS);
      vi.advanceTimersByTime(1_999);
      process.emitData("\u001b]6973;O;n1;--slow\u0007");
      const slowOptions: readonly string[] | null = (await slow).options;
      const warm: Promise<ShellOptionsReply> = session.askOptionsAsync(KEYS);
      vi.advanceTimersByTime(500);
      const warmReply: ShellOptionsReply = await warm;
      const restarted: FakePtyProcess = new FakePtyProcess();
      session.restart(restarted, "n1", new TerminalSize(80, 24));
      restarted.emitData(BOUND_PROMPT);
      const cold: Promise<ShellOptionsReply> = session.askOptionsAsync(KEYS);
      vi.advanceTimersByTime(1_999);
      const writesBefore: readonly string[] = [...restarted.writes];
      vi.advanceTimersByTime(1);

      assert.deepEqual([slowOptions, warmReply, writesBefore, await cold, restarted.writes],
        [["--slow"], ShellOptionsReply.timedOut, [KEYS], ShellOptionsReply.timedOut, [KEYS, "\t"]]);
      await session.disposeAsync();
    });
  });
});
