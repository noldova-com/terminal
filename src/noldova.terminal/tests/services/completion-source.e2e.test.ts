/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { finished } from "node:stream/promises";

import { type OwnedProcess, ProcessExit } from "@noldova/desktop.runtime";
import { FakeModuleLog, FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
import type { TerminalMissingCommands } from "@noldova/terminal.protocol";
import { afterEach, describe, it, vi } from "vitest";

import { CommandRunner } from "../../src/services/command-runner.ts";
import { CommandTracker } from "../../src/services/command-tracker.ts";
import { CompletionSource } from "../../src/services/completion-source.ts";
import { FakeFileSystemReader } from "../fixtures/fake-file-system-reader.fixture.ts";
import { SpawnedPrograms } from "../fixtures/spawned-programs.fixture.ts";

const POWERSHELL: string | null = findPowerShell();

describe("CompletionSource with this computer's PowerShell, Windows PowerShell on Windows and PowerShell 7 elsewhere", () => {
  let programs: SpawnedPrograms = new SpawnedPrograms();

  afterEach(async () => {
    vi.useRealTimers();
    await programs.stopAllAsync();
    programs = new SpawnedPrograms();
  });

  it("finds none missing once PowerShell's lookup runs past its time, lets that PowerShell run on to its own end, and then looks up again", async context => {
    if (POWERSHELL === null)
      return context.skip("No PowerShell is installed.");
    const runtime: FakeRuntimePartContext = new FakeRuntimePartContext();
    runtime.answer("startProcessAsync", t => programs.startAsync(t));
    const log: FakeModuleLog = new FakeModuleLog();
    const source: CompletionSource = new CompletionSource(new FakeFileSystemReader(), new CommandRunner(runtime), process.platform, homedir(), log);
    const shell: CommandTracker = new CommandTracker(() => "");
    const environment: Readonly<Record<string, string>> = { PATH: process.env["PATH"] ?? "" };
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    const started: Promise<OwnedProcess> = programs.nextStartAsync();
    const late: Promise<TerminalMissingCommands> = source.findMissingPowerShellAsync(shell, POWERSHELL, ["noldovanone"], new Set(), environment);
    const lookup: OwnedProcess = await started;
    await vi.advanceTimersByTimeAsync(10_000);
    const lateNames: readonly string[] = (await late).names;
    const exit: ProcessExit = await lookup.exited;
    await Promise.all([finished(lookup.output), finished(lookup.errors)]);
    await new Promise<void>(resolve => setImmediate(resolve));
    const nextNames: readonly string[] = (await source.findMissingPowerShellAsync(shell, POWERSHELL, ["noldovanone"], new Set(), environment)).names;

    assert.deepEqual([lateNames, exit, nextNames, programs.programs.length], [[], new ProcessExit(0, null), ["noldovanone"], 2]);
    assert.deepEqual(log.callsOf("write").map(t => t[0]), [`PowerShell's lookup of 1 name a command line runs gave up, so they count as found, as later ones do until one succeeds: ${path.basename(POWERSHELL)} did not end within 10 seconds.`]);
  });
});

function findPowerShell(): string | null {
  const program: string = process.platform === "win32"
    ? path.join(process.env["SystemRoot"] ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
    : "pwsh";
  const found: SpawnSyncReturns<string> = spawnSync(program, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "(Get-Process -Id $PID).Path"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
  const file: string = found.status === 0 ? found.stdout.trim() : "";
  return path.isAbsolute(file) ? file : null;
}
