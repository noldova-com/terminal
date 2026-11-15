/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ProcessExit } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { CommandExitedException } from "../../src/exceptions/command-exited.exception.ts";
import { WslDistributionsUnreadableException } from "../../src/exceptions/wsl-distributions-unreadable.exception.ts";
import { Resources } from "../../src/resources.ts";
import { WslDistributionReader } from "../../src/services/wsl-distribution.reader.ts";
import { FakeCommandRunner } from "../fixtures/fake-command-runner.fixture.ts";

const POWERSHELL: string = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const UNREADABLE: string = "The shell list leaves out the WSL distributions, which could not be read.";

function line(name: string, isDefault: boolean): string {
  return `${Buffer.from(name, "utf8").toString("base64")} ${isDefault ? "1" : "0"}`;
}

function readAsync(output: string | Error): Promise<readonly string[]> {
  const runner: FakeCommandRunner = new FakeCommandRunner();
  runner.answers.set(POWERSHELL, output);
  return new WslDistributionReader(runner, "C:\\Windows").readAsync();
}

describe("WslDistributionReader", () => {
  it("reads the distributions from the registry through Windows PowerShell, the default first", async () => {
    const runner: FakeCommandRunner = new FakeCommandRunner();
    runner.answers.set(POWERSHELL, [line("docker-desktop", false), line("Ubuntu", true), line("Débian 日本", false), "End", ""].join("\r\n"));

    assert.deepEqual(await new WslDistributionReader(runner, "C:\\Windows").readAsync(), ["Ubuntu", "docker-desktop", "Débian 日本"]);
    assert.deepEqual(runner.runs.map(t => [t[0], t[1].slice(0, 4), Buffer.from(t[1][4] ?? "", "base64").toString("utf16le"), t[2]]),
      [[POWERSHELL, ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand"], Resources.wslDistributionScript, 60_000]]);
  });

  it("reads no distributions without WSL", async () => {
    assert.deepEqual(await readAsync("End\n"), []);
  });

  it("reads output that starts with a byte order mark", async () => {
    assert.deepEqual(await readAsync(`﻿${line("Ubuntu", true)}\nEnd\n`), ["Ubuntu"]);
  });

  it("refuses output it can't read", async () => {
    const valid: string = line("Ubuntu", true);
    const outputs: readonly string[] = [valid, `${valid} extra\nEnd`, `${valid.replace(" 1", " 2")}\nEnd`, "VWJ1bnR1\nEnd", " 1\nEnd", "VWJ1bnR! 0\nEnd"];

    for (const output of outputs)
      await assert.rejects(readAsync(output), (error: unknown) => error instanceof WslDistributionsUnreadableException && error.message === UNREADABLE
        && error.cause === undefined);
  });

  it("reports Windows PowerShell's failure, keeping it as the cause", async () => {
    const exited: CommandExitedException = new CommandExitedException("powershell.exe", new ProcessExit(3, null));
    await assert.rejects(readAsync(exited), (error: unknown) => error instanceof WslDistributionsUnreadableException && error.message === UNREADABLE
      && error.cause === exited);
  });

  it("passes on a failure of the run that isn't Windows PowerShell's", async () => {
    const failure: TypeError = new TypeError("broken");

    await assert.rejects(readAsync(failure), failure);
  });
});
