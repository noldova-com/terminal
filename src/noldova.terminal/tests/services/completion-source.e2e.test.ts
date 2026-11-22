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

import { type OwnedProcess, ProcessExit } from "@noldova/desktop.runtime";
import { FakeModuleLog, FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
import type { TerminalMissingCommands } from "@noldova/terminal.protocol";
import { afterEach, describe, it, vi } from "vitest";

import type { CommandRun } from "../../src/models/command-run.ts";
import { CommandRunner } from "../../src/services/command-runner.ts";
import { CommandTracker } from "../../src/services/command-tracker.ts";
import { CompletionSource } from "../../src/services/completion-source.ts";
import { FakeFileSystemReader } from "../fixtures/fake-file-system-reader.fixture.ts";
import { SpawnedPrograms } from "../fixtures/spawned-programs.fixture.ts";

const POWERSHELL: string | null = findPowerShell();
const START_MS: number = 30_000;
const GIVE_UP_MS: number = 30_000;
const OWN_END_MS: number = 150_000;
const OUTPUT_CLOSE_MS: number = 30_000;
const NEXT_LOOKUP_MS: number = 30_000;
const TEST_MS: number = [START_MS, GIVE_UP_MS, OWN_END_MS, OUTPUT_CLOSE_MS, NEXT_LOOKUP_MS].reduce((sum, t) => sum + t, 10_000);

class WatchedRunner extends CommandRunner {
  public readonly runs: CommandRun[] = [];

  public override start(file: string, args: readonly string[], timeoutMilliseconds: number, endMilliseconds: number,
    environment?: Readonly<Record<string, string>>): CommandRun {
    const run: CommandRun = super.start(file, args, timeoutMilliseconds, endMilliseconds, environment);
    this.runs.push(run);
    return run;
  }
}

class StepTrail {
  private readonly begun: number = performance.now();
  private readonly steps: string[] = [];

  public async withinAsync<T>(promise: Promise<T>, milliseconds: number, step: string): Promise<T> {
    const limit: AbortSignal = AbortSignal.timeout(milliseconds);
    const ranOut: Promise<never> = new Promise<never>((_, reject) => limit.addEventListener("abort",
      () => reject(new Error(`Waited ${String(milliseconds / 1000)} s for ${step}, after ${this.toString() || "no step"}.`)), { once: true }));
    const value: T = await Promise.race([promise, ranOut]);
    this.steps.push(`${step} at ${((performance.now() - this.begun) / 1000).toFixed(1)} s`);
    return value;
  }

  public toString(): string {
    return this.steps.join(", ");
  }
}

describe("CompletionSource with this computer's PowerShell, Windows PowerShell on Windows and PowerShell 7 elsewhere", () => {
  let programs: SpawnedPrograms = new SpawnedPrograms();

  afterEach(async () => {
    vi.useRealTimers();
    await programs.stopAllAsync();
    programs = new SpawnedPrograms();
  });

  it("finds none missing once PowerShell's lookup runs past its time, lets that PowerShell run on to its own end, and then looks up again", { timeout: TEST_MS }, async context => {
    if (POWERSHELL === null)
      return context.skip("No PowerShell is installed.");
    const runtime: FakeRuntimePartContext = new FakeRuntimePartContext();
    runtime.answer("startProcessAsync", t => programs.startAsync(t));
    const log: FakeModuleLog = new FakeModuleLog();
    const runner: WatchedRunner = new WatchedRunner(runtime);
    const source: CompletionSource = new CompletionSource(new FakeFileSystemReader(), runner, process.platform, homedir(), log);
    const shell: CommandTracker = new CommandTracker(() => "");
    const environment: Readonly<Record<string, string>> = { PATH: process.env["PATH"] ?? "" };
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const steps: StepTrail = new StepTrail();

    const started: Promise<OwnedProcess> = programs.nextStartAsync();
    const late: Promise<TerminalMissingCommands> = source.findMissingPowerShellAsync(shell, POWERSHELL, ["noldovanone"], new Set(), environment);
    const lookup: OwnedProcess = await steps.withinAsync(started, START_MS, "the first PowerShell's start");
    await vi.advanceTimersByTimeAsync(10_000);
    const lateNames: readonly string[] = (await steps.withinAsync(late, GIVE_UP_MS, "the first lookup's give-up")).names;
    const exit: ProcessExit = await steps.withinAsync(lookup.exited, OWN_END_MS, "the first PowerShell's own end");
    await steps.withinAsync(runner.runs[0]?.ended ?? Promise.resolve(), OUTPUT_CLOSE_MS, "the close of the first run's output");
    const nextNames: readonly string[] = (await steps.withinAsync(source.findMissingPowerShellAsync(shell, POWERSHELL, ["noldovanone"], new Set(), environment),
      NEXT_LOOKUP_MS, "the second lookup's answer")).names;
    const writes: readonly unknown[] = log.callsOf("write").map(t => t[0]);
    const report: string = `${steps.toString()}; the log wrote ${JSON.stringify(writes)}`;

    assert.deepEqual([lateNames, exit, nextNames, programs.programs.length], [[], new ProcessExit(0, null), ["noldovanone"], 2], report);
    assert.deepEqual(writes, [`PowerShell's lookup of 1 name a command line runs gave up, so they count as found, as later ones do until one succeeds: ${path.basename(POWERSHELL)} did not end within 10 seconds.`], report);
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
