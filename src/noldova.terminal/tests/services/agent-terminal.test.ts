/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";

import { TerminalSize } from "@noldova/terminal.protocol";
import { describe, it, vi } from "vitest";

import type { HostedTerminal } from "../../src/models/hosted-terminal.ts";
import { TerminalPrompt } from "../../src/models/terminal-prompt.ts";
import { AgentTerminal } from "../../src/services/agent-terminal.ts";
import { StaleTerminalException } from "../../src/tools/exceptions/stale-terminal.exception.ts";
import type { IAgentCommand } from "../../src/tools/interfaces/i-agent-command.ts";
import type { ITerminalPrompt } from "../../src/tools/interfaces/i-terminal-prompt.ts";
import { OutputChunk } from "../../src/tools/models/output-chunk.ts";
import { AgentHostFixture } from "../fixtures/agent-host.fixture.ts";
import type { FakePtyProcess } from "../fixtures/fake-pty-process.fixture.ts";

const SIGNAL: AbortSignal = new AbortController().signal;
const LOGS: string = path.join("/logs");

class AgentTerminalFixture extends AgentHostFixture {
  public async openAsync(shellId: string | null): Promise<AgentTerminal> {
    const spawning: Promise<FakePtyProcess> = this.spawner.nextSpawnAsync();
    const hosted: HostedTerminal = await this.host.openTerminalAsync(shellId, "/work", new TerminalSize(120, 30), "session-1", 104_857_600, null, false,
      "example.chat/42");
    await spawning;
    return new AgentTerminal(hosted, this.host, this.writer, LOGS, this.log);
  }

  public async openBashAsync(): Promise<AgentTerminal> {
    const terminal: AgentTerminal = await this.openAsync(null);
    this.showPrompt();
    await terminal.waitForIntegrationAsync(SIGNAL);
    return terminal;
  }

  public showPrompt(): void {
    this.process.emitData(`${this.mark("P", "Cwd=/work")}${this.mark("A")}$ ${this.mark("B")}`);
  }
}

describe("AgentTerminal", () => {
  it("tells its hosted terminal's id, title, shell, start folder, session and owner", async () => {
    const fixture: AgentTerminalFixture = new AgentTerminalFixture();

    const terminal: AgentTerminal = await fixture.openAsync(null);

    assert.notEqual(fixture.host.findTerminal(terminal.id), undefined);
    assert.deepEqual(
      [terminal.title, terminal.shellId, terminal.shellPath, terminal.startFolder, terminal.ownerSessionId, terminal.owner, terminal.isRunning],
      ["", "bash", "/bin/bash", "/work", "session-1", "example.chat/42", true]);
  });

  it("waits for the shell's first prompt, then reads it with its folder and offset", async () => {
    const fixture: AgentTerminalFixture = new AgentTerminalFixture();
    const terminal: AgentTerminal = await fixture.openAsync(null);
    const waiting: Promise<void> = terminal.waitForIntegrationAsync(SIGNAL);
    const before: boolean = terminal.hasShellIntegration;

    fixture.showPrompt();
    await waiting;

    assert.deepEqual([before, terminal.hasShellIntegration, terminal.hasPendingLine], [false, true, false]);
    assert.deepEqual(terminal.readPrompt(), new TerminalPrompt(true, "/work", 2, false, 0));
    assert.equal(terminal.readOneShotLine("make"), null);
  });

  it("stops waiting for the first prompt when the shell ends first", async () => {
    const fixture: AgentTerminalFixture = new AgentTerminalFixture();
    const terminal: AgentTerminal = await fixture.openAsync(null);
    const waiting: Promise<void> = terminal.waitForIntegrationAsync(SIGNAL);

    fixture.process.exit(127);
    await waiting;

    assert.deepEqual([terminal.isRunning, terminal.hasShellIntegration, terminal.readPrompt().isIdle], [false, false, false]);
  });

  it("stops waiting for the first prompt when the call ends, and leaves the shell running", async () => {
    const fixture: AgentTerminalFixture = new AgentTerminalFixture();
    const terminal: AgentTerminal = await fixture.openAsync(null);
    const controller: AbortController = new AbortController();
    const waiting: Promise<void> = terminal.waitForIntegrationAsync(controller.signal);

    controller.abort();
    await waiting;

    assert.deepEqual([terminal.isRunning, terminal.hasShellIntegration, fixture.process.ends], [true, false, 0]);
  });

  it("stops waiting for the first prompt of a shell that shows its own prompt but never marks after 10 seconds, and not before", async () => {
    const fixture: AgentTerminalFixture = new AgentTerminalFixture();
    const terminal: AgentTerminal = await fixture.openAsync(null);
    vi.useFakeTimers();
    try {
      let isDone: boolean = false;
      const waiting: Promise<void> = terminal.waitForIntegrationAsync(SIGNAL).then(() => {
        isDone = true;
      });
      fixture.process.emitData("$ ");

      await vi.advanceTimersByTimeAsync(9_999);
      const before: boolean = isDone;
      await vi.advanceTimersByTimeAsync(1);
      await waiting;

      assert.deepEqual([before, terminal.isRunning, terminal.hasShellIntegration], [false, true, false]);
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("waits for a shell that shows no text yet, as Windows PowerShell on a busy computer, until its first text or 60 seconds", async () => {
    const fixture: AgentTerminalFixture = new AgentTerminalFixture();
    const slow: AgentTerminal = await fixture.openAsync(null);
    const silent: AgentTerminal = await new AgentTerminalFixture().openAsync(null);
    vi.useFakeTimers();
    try {
      const done: Set<AgentTerminal> = new Set<AgentTerminal>();
      const waiting: Promise<void>[] = [slow, silent].map(t => t.waitForIntegrationAsync(SIGNAL).then(() => {
        done.add(t);
      }));
      fixture.process.emitData("\u001b[?9001h\u001b]0;powershell.exe\u001b\\");

      await vi.advanceTimersByTimeAsync(20_000);
      const whileStarting: number = done.size;
      fixture.showPrompt();
      await vi.advanceTimersByTimeAsync(0);
      const afterPrompt: boolean[] = [done.has(slow), done.has(silent)];
      await vi.advanceTimersByTimeAsync(39_999);
      const beforeLimit: boolean = done.has(silent);
      await vi.advanceTimersByTimeAsync(1);
      await Promise.all(waiting);

      assert.deepEqual([whileStarting, afterPrompt, beforeLimit, slow.hasShellIntegration, silent.isRunning], [0, [true, false], false, true, true]);
    }
    finally {
      vi.useRealTimers();
    }
  });

  const silentEnds: readonly (readonly [string, (fixture: AgentTerminalFixture, terminal: AgentTerminal) => Promise<void>])[] = [
    ["its shell exits", async fixture => fixture.process.exit(0)],
    ["its terminal closes", (fixture, terminal) => fixture.host.closeTerminalAsync(terminal.id)]
  ];
  for (const [ending, end] of silentEnds)
    it(`stops waiting at once when ${ending} at 20 seconds while it waits for a shell that shows no text yet`, async () => {
      const fixture: AgentTerminalFixture = new AgentTerminalFixture();
      const terminal: AgentTerminal = await fixture.openAsync(null);
      vi.useFakeTimers();
      let ended: Promise<void> = Promise.resolve();
      try {
        let isDone: boolean = false;
        const waiting: Promise<void> = terminal.waitForIntegrationAsync(SIGNAL).then(() => {
          isDone = true;
        });

        await vi.advanceTimersByTimeAsync(20_000);
        const whileWaiting: boolean = isDone;
        ended = end(fixture, terminal);
        await vi.advanceTimersByTimeAsync(0);
        const afterEnd: boolean = isDone;
        await waiting;

        assert.deepEqual([whileWaiting, afterEnd, terminal.isRunning, fixture.process.writes], [false, true, false, []]);
      }
      finally {
        vi.useRealTimers();
      }
      await ended;
    });

  it("waits past 10 seconds for the first prompt of a shell whose integration said it loaded, as while a slow profile runs", async () => {
    const fixture: AgentTerminalFixture = new AgentTerminalFixture();
    const terminal: AgentTerminal = await fixture.openAsync(null);
    vi.useFakeTimers();
    try {
      let isDone: boolean = false;
      const waiting: Promise<void> = terminal.waitForIntegrationAsync(SIGNAL).then(() => {
        isDone = true;
      });
      fixture.process.emitData(fixture.mark("L"));

      await vi.advanceTimersByTimeAsync(60_000);
      const doneBeforePrompt: boolean = isDone;
      fixture.showPrompt();
      await waiting;

      assert.deepEqual([doneBeforePrompt, terminal.hasShellIntegration], [false, true]);
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("waits for no prompt from a shell without integration, and reads its prompt without a folder or offset", async () => {
    const fixture: AgentTerminalFixture = new AgentTerminalFixture();
    const terminal: AgentTerminal = await fixture.openAsync("fish");

    await terminal.waitForIntegrationAsync(SIGNAL);

    assert.equal(terminal.hasShellIntegration, false);
    assert.deepEqual(terminal.readPrompt(), new TerminalPrompt(true, null, null, false, 0));
    assert.equal(terminal.readOneShotLine("make all"), "/usr/bin/fish -c \"make all\"");
  });

  it("runs a command in the shell at the prompt it showed, and keeps the terminal's log in its log folder", async () => {
    const fixture: AgentTerminalFixture = new AgentTerminalFixture();
    const terminal: AgentTerminal = await fixture.openBashAsync();
    const logFile: string = path.join(LOGS, `${terminal.id}.log`);

    const command: IAgentCommand = terminal.run("make", terminal.readPrompt(), 0);
    fixture.process.emitData(`make\r\n${fixture.mark("C")}built\r\n${fixture.mark("P", "Cwd=/work")}${fixture.mark("D", "0")}`);
    await command.waitForEndAsync(1_000, SIGNAL);
    await terminal.closeAsync();
    const writes: readonly string[] = [...fixture.process.writes];
    const next: IAgentCommand = terminal.run("ls", terminal.readPrompt(), 0);

    assert.deepEqual(writes, ["make\r"]);
    assert.deepEqual([command.method, command.status, command.exitCode, command.cwd, command.logFile, next.logFile],
      ["InShell", "Exited", 0, "/work", logFile, logFile]);
    assert.equal(fixture.writer.files.get(logFile), "make\nbuilt\n");
  });

  it("writes keys and interrupts at the prompt it showed", async () => {
    const fixture: AgentTerminalFixture = new AgentTerminalFixture();
    const terminal: AgentTerminal = await fixture.openBashAsync();

    terminal.write("y\r", terminal.readPrompt());
    terminal.interrupt(terminal.readPrompt());

    assert.deepEqual(fixture.process.writes, ["y\r", "\u0003"]);
  });

  it("tells a running command's wait for a password", async () => {
    const fixture: AgentTerminalFixture = new AgentTerminalFixture();
    const terminal: AgentTerminal = await fixture.openBashAsync();

    fixture.process.emitData(`sudo make\r\n${fixture.mark("C")}[sudo] password for a: `);

    assert.equal(terminal.isAwaitingSecret, true);
    assert.deepEqual(terminal.readPrompt(), new TerminalPrompt(false, "/work", null, true, 0));
  });

  it("refuses to run, write or interrupt at a prompt other than the one it showed, and sends nothing", async () => {
    const fixture: AgentTerminalFixture = new AgentTerminalFixture();
    const terminal: AgentTerminal = await fixture.openBashAsync();
    const shown: TerminalPrompt = new TerminalPrompt(true, "/work", 2, false, 0);
    const isStale = (error: unknown): boolean => {
      assert.ok(error instanceof StaleTerminalException);
      assert.equal(error.terminalId, terminal.id);
      assert.equal(error.message, `Terminal ${terminal.id} changed after the person allowed the action, so nothing was sent.`);
      return true;
    };

    fixture.showPrompt();

    assert.throws(() => terminal.run("make", shown, 0), isStale);
    assert.throws(() => terminal.write("y\r", shown), isStale);
    assert.throws(() => terminal.interrupt(shown), isStale);
    assert.deepEqual(fixture.process.writes, []);
    assert.equal(fixture.writer.files.has(path.join(LOGS, `${terminal.id}.log`)), false);
  });

  it("reads the terminal's text since an offset and waits for more, or for the shell's end", async () => {
    const fixture: AgentTerminalFixture = new AgentTerminalFixture();
    const terminal: AgentTerminal = await fixture.openBashAsync();

    const waiting: Promise<void> = terminal.waitForOutputAsync(2, 1_000, SIGNAL);
    fixture.process.emitData("\u001b[1mhi\u001b[0m");
    await waiting;
    const ending: Promise<void> = terminal.waitForOutputAsync(4, 1_000, SIGNAL);
    fixture.process.exit(0);
    await ending;

    assert.deepEqual(terminal.readSince(2), new OutputChunk("hi", 4));
    assert.equal(terminal.isRunning, false);
  });

  it("closes its terminal in the host", async () => {
    const fixture: AgentTerminalFixture = new AgentTerminalFixture();
    const terminal: AgentTerminal = await fixture.openBashAsync();

    await terminal.closeAsync();

    assert.equal(fixture.host.findTerminal(terminal.id), undefined);
    assert.equal(fixture.process.ends, 1);
  });

  it("runs a command as a one-shot in a shell without integration, and sends keys to it only while it runs", async () => {
    const fixture: AgentTerminalFixture = new AgentTerminalFixture();
    const terminal: AgentTerminal = await fixture.openAsync("fish");
    const shell: FakePtyProcess = fixture.process;
    const spawning: Promise<FakePtyProcess> = fixture.spawner.nextSpawnAsync();

    const command: IAgentCommand = terminal.run("make", terminal.readPrompt(), 0);
    const oneShot: FakePtyProcess = await spawning;
    await oneShot.waitUntilReadAsync();
    oneShot.emitData("Password: ");
    const asking: TerminalPrompt = new TerminalPrompt(false, null, null, true, 0);
    const prompt: ITerminalPrompt = terminal.readPrompt();
    terminal.write("secret\r", terminal.readPrompt());
    terminal.interrupt(terminal.readPrompt());
    oneShot.exit(1);
    await command.waitForEndAsync(1_000, SIGNAL);
    terminal.write("ls\r", terminal.readPrompt());

    assert.deepEqual(prompt, asking);
    assert.equal(fixture.spawner.calls.at(-1), "/usr/bin/fish [-c make] in /work at 120x30");
    assert.deepEqual(oneShot.writes, ["secret\r", "\u0003"]);
    assert.deepEqual([command.method, command.status, command.exitCode, terminal.isAwaitingSecret, terminal.readPrompt().isIdle],
      ["OneShot", "Exited", 1, false, true]);
    assert.deepEqual(shell.writes, ["ls\r"]);
  });

  it("ends a running one-shot when it closes", async () => {
    const fixture: AgentTerminalFixture = new AgentTerminalFixture();
    const terminal: AgentTerminal = await fixture.openAsync("fish");
    const shell: FakePtyProcess = fixture.process;
    const spawning: Promise<FakePtyProcess> = fixture.spawner.nextSpawnAsync();
    terminal.run("sleep 100", terminal.readPrompt(), 0);
    const oneShot: FakePtyProcess = await spawning;

    await terminal.closeAsync();

    assert.deepEqual([shell.ends, oneShot.ends], [1, 1]);
  });
});
