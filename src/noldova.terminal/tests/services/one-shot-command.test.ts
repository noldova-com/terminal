/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { TerminalShellKind } from "@noldova/terminal.protocol";
import { afterEach, describe, it, vi } from "vitest";

import { Shell } from "../../src/models/shell.ts";
import { LogFile } from "../../src/services/log-file.ts";
import { OneShotCommand } from "../../src/services/one-shot-command.ts";
import { OutputChunk } from "../../src/tools/models/output-chunk.ts";
import { AgentHostFixture } from "../fixtures/agent-host.fixture.ts";

const SIGNAL: AbortSignal = new AbortController().signal;
const CMD: string = "C:\\Windows\\System32\\cmd.exe";
const POWERSHELL: string = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";

class OneShotFixture extends AgentHostFixture {
  public readonly logFile: LogFile = new LogFile(this.writer, "/logs/t1.log", this.log);

  public runAsync(file: string = "/usr/bin/fish", timeoutMilliseconds: number = 0): Promise<OneShotCommand> {
    return this.runInAsync(new Shell("fish", "fish", TerminalShellKind.Fish, file, [], false), timeoutMilliseconds);
  }

  public async runInAsync(shell: Shell, timeoutMilliseconds: number = 0): Promise<OneShotCommand> {
    const command: OneShotCommand = new OneShotCommand(this.host, shell, "/work", "make all", timeoutMilliseconds, this.logFile, this.log);
    await command.started;
    return command;
  }
}

describe("OneShotCommand", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs the command as its own shell in the terminal's folder and reports its exit", async () => {
    const fixture: OneShotFixture = new OneShotFixture();
    const command: OneShotCommand = await fixture.runAsync();

    fixture.process.emitData("\u001b[1mbuilt\u001b[0m\r\n");
    await command.waitForOutputAsync(0, 1_000, SIGNAL);
    assert.deepEqual([command.status, command.isRunning], ["Running", true]);
    fixture.process.exit(2);
    await command.waitForEndAsync(1_000, SIGNAL);
    await fixture.logFile.flushAsync();

    assert.deepEqual(fixture.spawner.calls, ["/usr/bin/fish [-c make all] in /work at 120x30"]);
    assert.deepEqual([command.status, command.exitCode, command.cwd, command.isRunning, command.logFile], ["Exited", 2, null, false, "/logs/t1.log"]);
    assert.deepEqual(command.readSince(0), new OutputChunk("built\n", 6));
    assert.equal(fixture.writer.files.get("/logs/t1.log"), "built\n");
  });

  it("passes the command the way each shell takes it, Command Prompt's as its own command line", async () => {
    const fixture: OneShotFixture = new OneShotFixture();

    await fixture.runAsync(CMD);
    await fixture.runInAsync(new Shell("cmd", "Command Prompt", TerminalShellKind.CommandPrompt, CMD, ["/k"], false));
    await fixture.runAsync("C:\\Program Files\\PowerShell\\7\\pwsh.exe");
    await fixture.runAsync(POWERSHELL);

    assert.deepEqual(fixture.spawner.calls.map(t => t.slice(t.indexOf("["), t.lastIndexOf("]") + 1)), [
      "[/d /s /c \"make all\"]",
      "[/d /s /c \"make all\"]",
      "[-NoProfile -Command make all]",
      "[-NoProfile -Command make all]"
    ]);
  });

  it("runs the command in a WSL terminal's distribution, and after what a developer shell runs first, with its arguments", async () => {
    const fixture: OneShotFixture = new OneShotFixture();
    const script: string = "C:\\VS\\Build Tools\\Common7\\Tools\\VsDevCmd.bat";

    await fixture.runInAsync(new Shell("wsl-Ubuntu", "Ubuntu", TerminalShellKind.Wsl, "C:\\Windows\\System32\\wsl.exe", ["-d", "Ubuntu"], false));
    await fixture.runInAsync(new Shell("vs-a1-cmd", "Developer Command Prompt", TerminalShellKind.CommandPrompt, CMD,
      ["/K", script, "-startdir=none", "-arch=amd64", "-host_arch=amd64", "-note=a&b", "-x=c^d"], false));
    await fixture.runInAsync(new Shell("vs-a1-powershell", "Developer PowerShell", TerminalShellKind.PowerShell, POWERSHELL, [], false, "Enter-VsDevShell a1"));

    assert.deepEqual(fixture.spawner.calls.map(t => t.slice(0, t.lastIndexOf("]") + 1)), [
      "C:\\Windows\\System32\\wsl.exe [-d Ubuntu -e sh -c make all]",
      `${CMD} [/d /s /c ""${script}" -startdir=none -arch=amd64 -host_arch=amd64 "-note=a&b" "-x=c^d" && "${CMD}" /d /v:on /s /c ""${CMD}" ` +
        "/d /s /c \"set \"NOLDOVA_TERMINAL_COMMAND=\" ^& !NOLDOVA_TERMINAL_COMMAND!\"\"\"]",
      `${POWERSHELL} [-NoProfile -Command Enter-VsDevShell a1\nmake all]`
    ]);
    assert.deepEqual(fixture.spawner.environments.map(t => t["NOLDOVA_TERMINAL_COMMAND"]), [undefined, "make all", undefined]);
  });

  it("takes keys while it runs, and tells a password prompt", async () => {
    const fixture: OneShotFixture = new OneShotFixture();
    const command: OneShotCommand = await fixture.runAsync();

    fixture.process.emitData("Password: ");
    command.write("secret\r");

    assert.equal(command.status, "AwaitingInput");
    assert.deepEqual(fixture.process.writes, ["secret\r"]);
  });

  it("ends a command still running at its time limit, and reports it killed", async () => {
    vi.useFakeTimers();
    const fixture: OneShotFixture = new OneShotFixture();
    const command: OneShotCommand = await fixture.runAsync("/usr/bin/fish", 1_000);
    const finished: OneShotCommand = await fixture.runAsync("/usr/bin/fish", 1_000);
    fixture.process.exit(0);

    await vi.advanceTimersByTimeAsync(1_000);

    assert.deepEqual([command.interrupt(), finished.interrupt()], [false, false]);
    assert.deepEqual([command.status, command.exitCode], ["Killed", null]);
    assert.deepEqual([finished.status, finished.exitCode], ["Exited", 0]);
    assert.deepEqual(fixture.spawner.spawned.map(t => t.ends), [1, 1]);
    await command.endAsync();
    assert.deepEqual(fixture.spawner.spawned.map(t => t.ends), [1, 1]);
  });

  it("lets go of its time limit once the command ends before it, or could not start", async () => {
    vi.useFakeTimers();
    const fixture: OneShotFixture = new OneShotFixture();
    const command: OneShotCommand = await fixture.runAsync("/usr/bin/fish", 3_600_000);
    fixture.process.exit(0);
    const failing: OneShotFixture = new OneShotFixture();
    failing.spawner.failure = new Error("no such file");
    const unstarted: OneShotCommand = await failing.runAsync("/usr/bin/fish", 3_600_000);

    await vi.advanceTimersByTimeAsync(1_000);

    assert.deepEqual([command.status, unstarted.status, vi.getTimerCount()], ["Exited", "Exited", 0]);
  });

  it("reports a command that could not start as ended, in its output and in the module's log", async () => {
    for (const failure of [new Error("no such file"), "denied"]) {
      const fixture: OneShotFixture = new OneShotFixture();
      fixture.spawner.failure = failure;
      const command: OneShotCommand = await fixture.runAsync();
      const message: string = `The command could not start: ${failure instanceof Error ? failure.message : failure}`;

      command.write("ignored");
      await command.endAsync();

      assert.deepEqual([command.status, command.exitCode], ["Exited", null]);
      assert.equal(command.readSince(0).text, message);
      assert.deepEqual(fixture.log.messages, [message]);
    }
  });
});
