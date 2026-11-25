/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import timers from "node:timers/promises";

import { type PseudoTerminal, type PseudoTerminalExit, PseudoTerminalRequest, type Registration } from "@noldova/desktop.runtime";
import * as nodePty from "node-pty";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ProcessState } from "../fixtures/process-state.fixture.ts";
import { SupervisedTerminals } from "../fixtures/supervised-terminals.fixture.ts";

const WAIT_MS: number = 10_000;
const POLL_MS: number = 25;
const IS_WINDOWS: boolean = process.platform === "win32";
const SHELL: string = IS_WINDOWS ? "pwsh.exe" : "bash";
const SHELL_ARGUMENTS: readonly string[] = IS_WINDOWS ? ["-NoLogo", "-NoProfile"] : ["--noprofile", "--norc", "-i"];
const COMMAND: string = IS_WINDOWS
  ? "$child = Start-Process -PassThru -NoNewWindow -FilePath ping.exe -ArgumentList '-n', '600', '127.0.0.1'; Write-Output \"child=$($child.Id) sum=$(20 + 22)\"\r"
  : "true | sleep 600 & disown -h; echo \"child=$! sum=$((20 + 22))\"\r";
const ECHOED: RegExp = IS_WINDOWS ? /child=(\d+) sum=42/ : /child=(\d+) sum=42[^$]*\$ /;
const CONSOLE_HOSTS_SCRIPT: string =
  `@(Get-CimInstance Win32_Process -Filter "ParentProcessId=${process.pid}" | Where-Object Name -In 'OpenConsole.exe', 'conhost.exe' | ForEach-Object ProcessId) -join ','`;

function waitForOutputAsync(terminal: PseudoTerminal, pattern: RegExp, output: () => string): Promise<RegExpMatchArray> {
  return new Promise<RegExpMatchArray>((resolve, reject) => {
    const timer: NodeJS.Timeout = setTimeout(() => finish(new Error(`No output matched ${pattern} within ${WAIT_MS} ms. Output: ${JSON.stringify(output())}`)), WAIT_MS);
    const data: Registration = terminal.onOutput(() => check());
    let isWaiting: boolean = true;
    void terminal.exited.then(() => {
      if (isWaiting)
        finish(new Error(`The shell exited before its output matched ${pattern}. Output: ${JSON.stringify(output())}`));
    });

    function check(): void {
      const match: RegExpMatchArray | null = pattern.exec(output());
      if (!Object.isNull(match))
        finish(match);
    }

    function finish(result: RegExpMatchArray | Error): void {
      clearTimeout(timer);
      data[Symbol.dispose]();
      isWaiting = false;
      if (result instanceof Error)
        reject(result);
      else
        resolve(result);
    }

    check();
  });
}

function consoleHostPids(): readonly number[] {
  if (!IS_WINDOWS)
    return [];
  const result: SpawnSyncReturns<string> = spawnSync("pwsh", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", CONSOLE_HOSTS_SCRIPT], {
    encoding: "utf8",
    timeout: WAIT_MS
  });
  expect(result.status, `Listing the console hosts failed: ${result.error?.message ?? result.stderr}`).toBe(0);
  const list: string = result.stdout.trim();
  return list === "" ? [] : list.split(",").map(Number);
}

async function waitForExitAsync(exited: Promise<PseudoTerminalExit>): Promise<PseudoTerminalExit> {
  let timer: NodeJS.Timeout | undefined;
  const timeout: Promise<never> = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`The shell did not exit within ${WAIT_MS} ms of being ended.`)), WAIT_MS);
  });
  try {
    return await Promise.race([exited, timeout]);
  }
  finally {
    clearTimeout(timer);
  }
}

async function waitUntilEndedAsync(pid: number): Promise<void> {
  const deadline: number = Date.now() + WAIT_MS;
  while (ProcessState.isRunning(pid)) {
    if (Date.now() > deadline)
      throw new Error(`Process ${pid} was still running ${WAIT_MS} ms after its shell ended.`);
    await timers.setTimeout(POLL_MS);
  }
}

describe("pseudo-terminal", () => {
  let home: string = "";
  let terminals: SupervisedTerminals;

  beforeAll(async () => {
    home = await mkdtemp(join(tmpdir(), "noldova-terminal-"));
  });

  afterAll(async () => {
    await rm(home, { force: true, recursive: true });
  });

  beforeEach(async () => {
    terminals = await SupervisedTerminals.createAsync();
  });

  afterEach(async () => {
    await terminals.endAsync();
  });

  it(`runs ${SHELL}, reads an echo back, and ends it as the runtime does, with no process left`, async () => {
    let output: string = "";
    let childPid: number | null = null;
    const hostsBefore: readonly number[] = consoleHostPids();
    const environment: Record<string, string> = {
      ...Object.fromEntries(Object.entries(process.env).filter((t): t is [string, string] => !Object.isUndefined(t[1]))),
      HOME: home,
      PS1: "$ ",
      TERM: "xterm-256color"
    };
    const terminal: PseudoTerminal = await terminals.startAsync(new PseudoTerminalRequest(nodePty, SHELL, [...SHELL_ARGUMENTS], home, 80, 24, environment));
    terminal.onOutput(t => output += t);

    try {
      terminal.write(COMMAND);
      const match: RegExpMatchArray = await waitForOutputAsync(terminal, ECHOED, () => output);
      const shellPid: number = terminal.processId;
      childPid = Number(match[1]);
      const hosts: readonly number[] = consoleHostPids().filter(t => !hostsBefore.includes(t));
      expect(ProcessState.isRunning(childPid), "The background child should run while its shell does.").toBe(true);
      expect(!IS_WINDOWS || hosts.length > 0, "The pseudo-console should have its own console host.").toBe(true);

      const ending: Promise<boolean> = terminal.stopAsync();

      const exit: PseudoTerminalExit = await waitForExitAsync(terminal.exited);
      if (!IS_WINDOWS)
        expect(exit.signal, "The shell should end by the hangup it took at its prompt.").toBe("SIGHUP");
      expect(await ending, "The shell and its job should have ended within the grace.").toBe(true);
      for (const pid of [shellPid, childPid, ...hosts])
        await waitUntilEndedAsync(pid);
      expect(terminals.processes.programs).toEqual([]);
    }
    finally {
      if (!Object.isNull(childPid) && ProcessState.isRunning(childPid))
        process.kill(childPid, "SIGKILL");
    }
  });
});
