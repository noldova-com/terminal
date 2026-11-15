/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";

import type { JsonValue } from "@noldova/context.json";
import { TerminalAttachment, TerminalReference } from "@noldova/terminal.protocol";
import { describe, it, vi } from "vitest";

import { RequestClient } from "../../src/models/request-client.ts";
import { TerminalPrompt } from "../../src/models/terminal-prompt.ts";
import { AgentTerminals } from "../../src/services/agent-terminals.ts";
import { StaleTerminalException } from "../../src/tools/exceptions/stale-terminal.exception.ts";
import type { IAgentCommand } from "../../src/tools/interfaces/i-agent-command.ts";
import type { IAgentTerminal } from "../../src/tools/interfaces/i-agent-terminal.ts";
import type { ITerminalPrompt } from "../../src/tools/interfaces/i-terminal-prompt.ts";
import { AgentTerminalOpening } from "../../src/tools/models/agent-terminal-opening.ts";
import { OutputChunk } from "../../src/tools/models/output-chunk.ts";
import { AgentHostFixture } from "../fixtures/agent-host.fixture.ts";
import type { FakePtyProcess } from "../fixtures/fake-pty-process.fixture.ts";

const SIGNAL: AbortSignal = new AbortController().signal;
const LOGS: string = path.join("/logs");
const APP: RequestClient = new RequestClient(1, 1, true);

function passTime(milliseconds: number): void {
  vi.setSystemTime(Date.now() + milliseconds);
}

class TerminalsFixture extends AgentHostFixture {
  public readonly terminals: AgentTerminals = new AgentTerminals(this.host, this.writer, LOGS, this.log);

  public async openBashAsync(): Promise<IAgentTerminal> {
    const opening: Promise<IAgentTerminal> = this.terminals.openAsync(new AgentTerminalOpening("session-1", null, "/work"), SIGNAL);
    await this.spawnedAsync(1);
    this.process.emitData(`${this.mark("P", "Cwd=/work")}${this.mark("A")}$ ${this.mark("B")}`);
    return opening;
  }

  public openFishAsync(): Promise<IAgentTerminal> {
    return this.terminals.openAsync(new AgentTerminalOpening("session-1", "fish", "/work"), SIGNAL);
  }

  public async spawnedAsync(count: number): Promise<void> {
    while (this.spawner.spawned.length < count)
      await this.spawner.nextSpawnAsync();
    const spawned: FakePtyProcess | undefined = this.spawner.spawned[count - 1];
    assert.ok(spawned !== undefined);
    await spawned.waitUntilReadAsync();
  }
}

describe("AgentTerminals", () => {
  it("opens the default shell for a session in its folder, once its first prompt shows", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();

    const terminal: IAgentTerminal = await fixture.openBashAsync();

    assert.deepEqual(fixture.spawner.calls, ["/bin/bash [--init-file /tmp/noldova-terminal-1/noldova.bash -i] in /work at 120x30"]);
    assert.deepEqual(
      [terminal.ownerSessionId, terminal.shellId, terminal.shellPath, terminal.startFolder, terminal.title, terminal.hasShellIntegration, terminal.isRunning,
        terminal.isAwaitingSecret],
      ["session-1", "bash", "/bin/bash", "/work", "", true, true, false]);
    assert.deepEqual(terminal.readPrompt(), new TerminalPrompt(true, "/work", 2, false, 0));
    assert.equal(terminal.readOneShotLine("make"), null);
  });

  it("opens a terminal with the owner its session is bound to, which it keeps when the session ends and forgets the binding", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    fixture.host.bindAgentSession("session-1", "example.chat/42");

    const terminal: IAgentTerminal = await fixture.openBashAsync();
    const owner: string | null = fixture.terminals.findSessionOwner("session-1");
    fixture.terminals.endSession("session-1");
    const later: IAgentTerminal = await fixture.openFishAsync();

    assert.deepEqual([terminal.owner, owner, fixture.terminals.findSessionOwner("session-1"), later.owner], ["example.chat/42", "example.chat/42", null, null]);
    assert.deepEqual(fixture.terminals.list(), [terminal, later]);
  });

  it("opens a terminal with the owner the session's binding names, unless the app bound the session to another owner", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();

    const named: IAgentTerminal = await fixture.terminals.openAsync(new AgentTerminalOpening("session-1", "fish", "/work", "example.chat/7"), SIGNAL);
    fixture.host.bindAgentSession("session-1", "example.chat/42");
    const bound: IAgentTerminal = await fixture.terminals.openAsync(new AgentTerminalOpening("session-1", "fish", "/work", "example.chat/7"), SIGNAL);

    assert.deepEqual([named.owner, bound.owner], ["example.chat/7", "example.chat/42"]);
  });

  it("lists and finds the host's terminals, and forgets closed ones", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    const terminal: IAgentTerminal = await fixture.openFishAsync();

    assert.deepEqual(fixture.terminals.list(), [terminal]);
    assert.equal(fixture.terminals.find(terminal.id), terminal);
    assert.equal(fixture.terminals.find("other"), undefined);
    await terminal.closeAsync();
    await terminal.closeAsync();

    assert.deepEqual(fixture.terminals.list(), []);
    assert.equal(fixture.spawner.spawned[0]?.ends, 1);
  });

  it("runs a command at the prompt it showed, and keeps the terminal's log", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    const terminal: IAgentTerminal = await fixture.openBashAsync();

    const command: IAgentCommand = terminal.run("make", terminal.readPrompt(), 0);
    fixture.process.emitData(`make\r\n${fixture.mark("C")}built\r\n${fixture.mark("P", "Cwd=/work")}${fixture.mark("D", "0")}`);
    await command.waitForEndAsync(1_000, SIGNAL);
    await terminal.closeAsync();

    assert.deepEqual(fixture.process.writes, ["make\r"]);
    assert.deepEqual([command.method, command.status, command.exitCode, command.cwd, command.logFile], ["InShell", "Exited", 0, "/work", path.join(LOGS, `${terminal.id}.log`)]);
    assert.equal(fixture.writer.files.get(command.logFile), "make\nbuilt\n");
    assert.equal(terminal.run("ls", terminal.readPrompt(), 0).logFile, command.logFile);
  });

  it("keeps the person's commands for the panes of every terminal of that shell the person types in, and none of an agent's", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    await fixture.host.handleAsync("terminal.sessions", null, APP);
    fixture.host.bindAgentSession("session-1", "example.chat/42");
    const terminal: IAgentTerminal = await fixture.openBashAsync();
    const command: IAgentCommand = terminal.run("make", terminal.readPrompt(), 0);
    fixture.process.emitData(`make\r\n${fixture.mark("C")}${fixture.mark("D", "0")}`);
    await command.waitForEndAsync(1_000, SIGNAL);
    const open: JsonValue = { shellId: "bash", folder: "/work", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 };
    const first: string = TerminalReference.fromJson(await fixture.host.handleAsync("terminal.open", open, APP)).sessionId;
    const second: string = TerminalReference.fromJson(await fixture.host.handleAsync("terminal.open", open, APP)).sessionId;
    await fixture.spawnedAsync(3);
    const person: FakePtyProcess | undefined = fixture.spawner.spawned[1];
    assert.ok(person !== undefined);

    person.emitData(`${fixture.markFor(person, "A")}$ ${fixture.markFor(person, "B")}ls -la\r\n${fixture.markFor(person, "C")}`);
    await fixture.commandAdded.waitUntilAsync("The second terminal.commandAdded event", () => fixture.commandAdded.published.length === 2);
    const attachment: TerminalAttachment = TerminalAttachment.fromJson(await fixture.host.handleAsync("terminal.attach", { sessionId: second, paneId: "p1" }, APP));

    assert.deepEqual(fixture.commandAdded.published, [{ sessionId: first, command: "ls -la" }, { sessionId: second, command: "ls -la" }]);
    assert.deepEqual(attachment.commands, ["ls -la"]);
    assert.deepEqual(TerminalAttachment.fromJson(await fixture.host.handleAsync("terminal.attach", { sessionId: terminal.id, paneId: "p2" }, APP)).commands, []);
    await terminal.closeAsync();
  });

  it("keeps no command while the person has suggestions off, and drops those it kept", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    await fixture.host.handleAsync("terminal.sessions", null, APP);
    const open: JsonValue = { shellId: "bash", folder: "/work", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 };
    const opened: string = TerminalReference.fromJson(await fixture.host.handleAsync("terminal.open", open, APP)).sessionId;
    await fixture.spawnedAsync(1);
    const attachAsync: (paneId: string) => Promise<readonly string[]> = async paneId =>
      TerminalAttachment.fromJson(await fixture.host.handleAsync("terminal.attach", { sessionId: opened, paneId }, APP)).commands;
    const prompt: string = `${fixture.mark("A")}$ ${fixture.mark("B")}`;

    fixture.process.emitData(`${prompt}ls\r\n${fixture.mark("C")}`);
    await fixture.commandAdded.waitUntilAsync("The first terminal.commandAdded event", () => fixture.commandAdded.published.length === 1);
    const kept: readonly string[] = await attachAsync("p1");
    fixture.settings.change("terminal.suggestions", false);
    fixture.process.emitData(`${prompt}pwd\r\n${fixture.mark("C")}`);
    const off: readonly string[] = await attachAsync("p2");
    fixture.settings.change("terminal.suggestions", true);
    fixture.process.emitData(`${prompt}make\r\n${fixture.mark("C")}`);
    await fixture.commandAdded.waitUntilAsync("The second terminal.commandAdded event", () => fixture.commandAdded.published.length === 2);

    assert.deepEqual([kept, off, await attachAsync("p3")], [["ls"], [], ["make"]]);
    assert.deepEqual(fixture.commandAdded.published, [{ sessionId: opened, command: "ls" }, { sessionId: opened, command: "make" }]);
  });

  it("drops the kept commands as soon as the person turns suggestions off", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    await fixture.host.handleAsync("terminal.sessions", null, APP);
    const open: JsonValue = { shellId: "bash", folder: "/work", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 };
    const opened: string = TerminalReference.fromJson(await fixture.host.handleAsync("terminal.open", open, APP)).sessionId;
    await fixture.spawnedAsync(1);
    fixture.process.emitData(`${fixture.mark("A")}$ ${fixture.mark("B")}ls\r\n${fixture.mark("C")}`);
    await fixture.commandAdded.waitUntilAsync("The first terminal.commandAdded event", () => fixture.commandAdded.published.length === 1);

    fixture.settings.change("terminal.suggestions", false);
    fixture.settings.change("terminal.suggestions", true);

    assert.deepEqual(TerminalAttachment.fromJson(await fixture.host.handleAsync("terminal.attach", { sessionId: opened, paneId: "p1" }, APP)).commands, []);
  });

  it("refuses to act on a prompt other than the one it showed", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    const terminal: IAgentTerminal = await fixture.openBashAsync();
    const shown: TerminalPrompt = new TerminalPrompt(true, "/work", 2, false, 0);

    fixture.process.emitData(`${fixture.mark("P", "Cwd=/work")}${fixture.mark("A")}$ ${fixture.mark("B")}`);

    assert.throws(() => terminal.run("make", shown, 0), StaleTerminalException);
    assert.throws(() => terminal.write("y\r", shown), StaleTerminalException);
    assert.throws(() => terminal.interrupt(shown), StaleTerminalException);
    assert.deepEqual(fixture.process.writes, []);
  });

  it("acts on the prompt it showed after the shell drew it again, and reads the person's line after the new drawing", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    const terminal: IAgentTerminal = await fixture.openBashAsync();
    const shown: ITerminalPrompt = terminal.readPrompt();

    fixture.process.emitData(`\r\u001b[K${fixture.mark("A")}$ ${fixture.mark("B")}`);
    const drawn: ITerminalPrompt = terminal.readPrompt();
    terminal.run("make", shown, 0);

    assert.deepEqual(drawn, shown);
    assert.equal(terminal.hasPendingLine, false);
    assert.deepEqual(fixture.process.writes, ["make\r"]);
  });

  it("refuses to act on a prompt the person typed at since it showed, even before the shell echoes the keys", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    fixture.host.bindAgentSession("session-1", "example.chat/42");
    const terminal: IAgentTerminal = await fixture.openBashAsync();
    const shown: TerminalPrompt = new TerminalPrompt(true, "/work", 2, false, 0);

    await fixture.host.handleAsync("terminal.input", { sessionId: terminal.id, data: "rm -rf " }, APP);

    assert.throws(() => terminal.run("make", shown, 0), StaleTerminalException);
    assert.deepEqual(terminal.readPrompt(), new TerminalPrompt(false, "/work", 2, false, 1));
    assert.deepEqual(fixture.process.writes, ["rm -rf "]);
  });

  it("acts on a prompt its pane sent a focus report at since it showed, as when the person clicks Allow elsewhere in the app", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    fixture.host.bindAgentSession("session-1", "example.chat/42");
    const terminal: IAgentTerminal = await fixture.openBashAsync();
    const shown: ITerminalPrompt = terminal.readPrompt();

    await fixture.host.handleAsync("terminal.input", { sessionId: terminal.id, data: "\u001b[O" }, APP);
    terminal.run("make", shown, 0);

    assert.deepEqual(fixture.process.writes, ["\u001b[O", "make\r"]);
  });

  it("refuses to act on a prompt the person typed at after a focus report since it showed", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    fixture.host.bindAgentSession("session-1", "example.chat/42");
    const terminal: IAgentTerminal = await fixture.openBashAsync();
    const shown: ITerminalPrompt = terminal.readPrompt();

    await fixture.host.handleAsync("terminal.input", { sessionId: terminal.id, data: "\u001b[O" }, APP);
    await fixture.host.handleAsync("terminal.input", { sessionId: terminal.id, data: "l" }, APP);

    assert.throws(() => terminal.run("make", shown, 0), StaleTerminalException);
    assert.deepEqual(fixture.process.writes, ["\u001b[O", "l"]);
  });

  it("reads the prompt as busy while the person's keys wait for their echo, and after it, until the shell waits at a new prompt", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    fixture.host.bindAgentSession("session-1", "example.chat/42");
    const terminal: IAgentTerminal = await fixture.openBashAsync();

    await fixture.host.handleAsync("terminal.input", { sessionId: terminal.id, data: "make\r" }, APP);
    const unechoed: boolean = terminal.readPrompt().isIdle;
    fixture.process.emitData("make");
    const echoed: boolean = terminal.readPrompt().isIdle;
    fixture.process.emitData(`\r\n${fixture.mark("C")}${fixture.mark("D", "0")}${fixture.mark("A")}$ ${fixture.mark("B")}`);

    assert.deepEqual([unechoed, echoed, terminal.readPrompt().isIdle], [false, false, true]);
    assert.throws(() => terminal.run("ls", new TerminalPrompt(false, "/work", 2, false, 1), 0), StaleTerminalException);
  });

  it("reads a new prompt that no command reached, as after Ctrl+C, as busy until the keys' settle passes", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    fixture.host.bindAgentSession("session-1", "example.chat/42");
    const terminal: IAgentTerminal = await fixture.openBashAsync();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      await fixture.host.handleAsync("terminal.input", { sessionId: terminal.id, data: "rm -rf " }, APP);
      fixture.process.emitData(`rm -rf ^C\r\n${fixture.mark("A")}$ ${fixture.mark("B")}`);
      const cleared: boolean = terminal.readPrompt().isIdle;
      passTime(999);
      const unsettled: boolean = terminal.readPrompt().isIdle;
      passTime(1);

      assert.deepEqual([cleared, unsettled, terminal.readPrompt().isIdle], [false, false, true]);
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("reads the prompt as busy while a key's first output is only cursor codes, as PowerShell's line editor sends before the key's text", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    fixture.host.bindAgentSession("session-1", "example.chat/42");
    const terminal: IAgentTerminal = await fixture.openBashAsync();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      await fixture.host.handleAsync("terminal.input", { sessionId: terminal.id, data: "l" }, APP);
      fixture.process.emitData("\u001b[?25l\u001b[1;3H");
      const codes: boolean = terminal.readPrompt().isIdle;
      fixture.process.emitData("l\u001b[?25h");
      const typed: boolean = terminal.readPrompt().isIdle;
      passTime(1_000);

      assert.deepEqual([codes, typed, terminal.readPrompt().isIdle], [false, false, false]);
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("reads the prompt as idle a settle after a key whose output leaves no text, such as a cursor move or a bell, and not before", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    fixture.host.bindAgentSession("session-1", "example.chat/42");
    const terminal: IAgentTerminal = await fixture.openBashAsync();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      await fixture.host.handleAsync("terminal.input", { sessionId: terminal.id, data: "\u001b[D" }, APP);
      fixture.process.emitData("\b");
      const moved: boolean = terminal.readPrompt().isIdle;
      passTime(1_000);
      const settled: boolean = terminal.readPrompt().isIdle;
      await fixture.host.handleAsync("terminal.input", { sessionId: terminal.id, data: "\u001b[A" }, APP);
      fixture.process.emitData("\u0007");
      const rang: boolean = terminal.readPrompt().isIdle;
      passTime(1_000);

      assert.deepEqual([moved, settled, rang, terminal.readPrompt().isIdle], [false, true, false, true]);
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("reads the prompt as idle at once after a focus report, which the shell never echoes, and busy at the next key", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    fixture.host.bindAgentSession("session-1", "example.chat/42");
    const terminal: IAgentTerminal = await fixture.openBashAsync();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      await fixture.host.handleAsync("terminal.input", { sessionId: terminal.id, data: "\u001b[I" }, APP);
      const reported: boolean = terminal.readPrompt().isIdle;
      await fixture.host.handleAsync("terminal.input", { sessionId: terminal.id, data: "l" }, APP);

      assert.deepEqual([reported, terminal.readPrompt().isIdle], [true, false]);
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("reads the prompt as busy after a key and then a focus report, which leaves the key's settle as it was", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    fixture.host.bindAgentSession("session-1", "example.chat/42");
    const terminal: IAgentTerminal = await fixture.openBashAsync();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      await fixture.host.handleAsync("terminal.input", { sessionId: terminal.id, data: "l" }, APP);
      await fixture.host.handleAsync("terminal.input", { sessionId: terminal.id, data: "\u001b[I" }, APP);

      assert.equal(terminal.readPrompt().isIdle, false);
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("reads the prompt as idle a settle after a key the shell swallows, and busy again at the next key", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    fixture.host.bindAgentSession("session-1", "example.chat/42");
    const terminal: IAgentTerminal = await fixture.openBashAsync();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      await fixture.host.handleAsync("terminal.input", { sessionId: terminal.id, data: "\u0018" }, APP);
      const swallowed: boolean = terminal.readPrompt().isIdle;
      passTime(1_000);
      const settled: boolean = terminal.readPrompt().isIdle;
      await fixture.host.handleAsync("terminal.input", { sessionId: terminal.id, data: "x" }, APP);

      assert.deepEqual([swallowed, settled, terminal.readPrompt().isIdle], [false, true, false]);
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("reads a terminal without integration as busy for a settle after the person's keys, whatever output comes, since a background job's can't be told from their echo", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    fixture.host.bindAgentSession("session-1", "example.chat/42");
    const terminal: IAgentTerminal = await fixture.openFishAsync();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      await fixture.host.handleAsync("terminal.input", { sessionId: terminal.id, data: "x" }, APP);
      fixture.process.emitData("[1]+  Done  sleep 1\r\n");
      const output: boolean = terminal.readPrompt().isIdle;
      passTime(1_000);

      assert.deepEqual([output, terminal.readPrompt().isIdle], [false, true]);
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("tells a pending line while the person's keys are under a settle old or their text waits on the shell's line", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    fixture.host.bindAgentSession("session-1", "example.chat/42");
    const terminal: IAgentTerminal = await fixture.openBashAsync();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const shown: boolean = terminal.hasPendingLine;
      await fixture.host.handleAsync("terminal.input", { sessionId: terminal.id, data: "rm -rf " }, APP);
      const typed: boolean = terminal.hasPendingLine;
      fixture.process.emitData("rm -rf ");
      passTime(1_000);
      const echoed: boolean = terminal.hasPendingLine;
      fixture.process.emitData(`^C\r\n${fixture.mark("A")}$ ${fixture.mark("B")}`);

      assert.deepEqual([shown, typed, echoed, terminal.hasPendingLine], [false, true, true, false]);
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("tells a pending line only by the settle while a command runs, or in a terminal without integration", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    fixture.host.bindAgentSession("session-1", "example.chat/42");
    const bash: IAgentTerminal = await fixture.openBashAsync();
    fixture.process.emitData(`make\r\n${fixture.mark("C")}Continue? `);
    const asking: boolean = bash.hasPendingLine;
    const fish: IAgentTerminal = await fixture.openFishAsync();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      await fixture.host.handleAsync("terminal.input", { sessionId: bash.id, data: "y" }, APP);
      await fixture.host.handleAsync("terminal.input", { sessionId: fish.id, data: "y" }, APP);
      const typed: boolean[] = [bash.hasPendingLine, fish.hasPendingLine];
      passTime(1_000);

      assert.deepEqual([asking, ...typed, bash.hasPendingLine, fish.hasPendingLine], [false, true, true, false, false]);
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("writes keys and interrupts, and tells a running command's wait for a password", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    const terminal: IAgentTerminal = await fixture.openBashAsync();

    fixture.process.emitData("sudo make");
    assert.equal(terminal.readPrompt().isIdle, false);
    fixture.process.emitData(`\r\n${fixture.mark("C")}[sudo] password for a: `);
    terminal.write("secret\r", terminal.readPrompt());
    terminal.interrupt(terminal.readPrompt());

    assert.deepEqual(terminal.readPrompt(), new TerminalPrompt(false, "/work", null, true, 0));
    assert.deepEqual(fixture.process.writes, ["secret\r", "\u0003"]);
  });

  it("keeps a command that survives the agent's interrupt running, and ends one whose shell marks nothing for it at the next prompt", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    const terminal: IAgentTerminal = await fixture.openBashAsync();
    const subshell: IAgentCommand = terminal.run("(sleep 100)", terminal.readPrompt(), 0);
    fixture.process.emitData("(sleep 100)\r\n");
    terminal.interrupt(terminal.readPrompt());
    fixture.process.emitData(`^C\r\n${fixture.mark("P", "Cwd=/work")}${fixture.mark("A")}$ ${fixture.mark("B")}`);
    const subshellState: readonly unknown[] = [subshell.status, subshell.exitCode];
    vi.useFakeTimers();
    try {
      const command: IAgentCommand = terminal.run("python3", terminal.readPrompt(), 0);
      fixture.process.emitData(`python3\r\n${fixture.mark("C")}>>> `);

      terminal.interrupt(terminal.readPrompt());
      fixture.process.emitData("\r\nKeyboardInterrupt\r\n>>> ");
      await vi.advanceTimersByTimeAsync(10_000);

      assert.deepEqual(subshellState, ["Exited", null]);
      assert.deepEqual([command.status, command.exitCode], ["Running", null]);
      assert.deepEqual(fixture.process.writes, ["(sleep 100)\r", "\u0003", "python3\r", "\u0003"]);
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("reads the terminal's text and waits for more", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    const terminal: IAgentTerminal = await fixture.openBashAsync();

    const waiting: Promise<void> = terminal.waitForOutputAsync(2, 1_000, SIGNAL);
    fixture.process.emitData("\u001b[1mhi\u001b[0m");
    await waiting;
    fixture.process.exit(0);
    await terminal.waitForOutputAsync(4, 1_000, SIGNAL);

    assert.deepEqual(terminal.readSince(2), new OutputChunk("hi", 4));
    assert.deepEqual([terminal.isRunning, terminal.readPrompt().isIdle], [false, false]);
  });

  it("stops waiting for the first prompt when the shell ends first", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    const opening: Promise<IAgentTerminal> = fixture.terminals.openAsync(new AgentTerminalOpening("session-1", "bash", "/work"), SIGNAL);
    await fixture.spawnedAsync(1);

    fixture.process.exit(127);

    assert.equal((await opening).hasShellIntegration, false);
  });

  it("stops waiting for the first prompt when the call ends, and leaves the terminal open", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    const controller: AbortController = new AbortController();
    const opening: Promise<IAgentTerminal> = fixture.terminals.openAsync(new AgentTerminalOpening("session-1", "bash", "/work"), controller.signal);
    await fixture.spawnedAsync(1);

    controller.abort();
    const terminal: IAgentTerminal = await opening;

    assert.deepEqual([terminal.isRunning, fixture.spawner.spawned[0]?.ends], [true, 0]);
  });

  it("runs each command as a one-shot in a terminal without integration, and sends keys to it while it runs", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    const terminal: IAgentTerminal = await fixture.openFishAsync();
    assert.deepEqual(terminal.readPrompt(), new TerminalPrompt(true, null, null, false, 0));
    assert.equal(terminal.readOneShotLine("make all"), "/usr/bin/fish -c \"make all\"");

    const command: IAgentCommand = terminal.run("make", terminal.readPrompt(), 0);
    await fixture.spawnedAsync(2);
    const oneShot: number = 1;
    fixture.spawner.spawned[oneShot]?.emitData("Password: ");
    terminal.write("secret\r", terminal.readPrompt());
    terminal.interrupt(terminal.readPrompt());

    assert.deepEqual(terminal.readPrompt(), new TerminalPrompt(false, null, null, true, 0));
    assert.deepEqual(fixture.spawner.calls[oneShot], "/usr/bin/fish [-c make] in /work at 120x30");
    assert.deepEqual(fixture.spawner.spawned[oneShot]?.writes, ["secret\r", "\u0003"]);
    fixture.spawner.spawned[oneShot]?.exit(1);
    await command.waitForEndAsync(1_000, SIGNAL);
    terminal.write("ls\r", terminal.readPrompt());

    assert.deepEqual([command.method, command.status, command.exitCode, terminal.readPrompt().isIdle, terminal.isAwaitingSecret], ["OneShot", "Exited", 1, true, false]);
    assert.deepEqual(fixture.spawner.spawned[0]?.writes, ["ls\r"]);
  });

  it("ends a running one-shot when its terminal closes", async () => {
    const fixture: TerminalsFixture = new TerminalsFixture();
    const terminal: IAgentTerminal = await fixture.openFishAsync();
    terminal.run("sleep 100", terminal.readPrompt(), 0);
    await fixture.spawnedAsync(2);

    await terminal.closeAsync();

    assert.deepEqual(fixture.spawner.spawned.map(t => t.ends), [1, 1]);
  });
});
