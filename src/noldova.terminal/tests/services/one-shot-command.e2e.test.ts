/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { FakeModuleLog, FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
import { TerminalShellKind } from "@noldova/terminal.protocol";
import { afterAll, beforeAll, describe, it } from "vitest";

import type { IPtyProcess } from "../../src/interfaces/i-pty-process.ts";
import type { OneShotLaunch } from "../../src/models/one-shot-launch.ts";
import { Shell } from "../../src/models/shell.ts";
import type { VisualStudioInstallation } from "../../src/models/visual-studio-installation.ts";
import { CommandRunner } from "../../src/services/command-runner.ts";
import { ContextPtySpawner } from "../../src/services/context-pty-spawner.ts";
import { FileSystemReader } from "../../src/services/file-system.reader.ts";
import { OneShotCommand } from "../../src/services/one-shot-command.ts";
import { ShellLocator } from "../../src/services/shell-locator.ts";
import { VisualStudioReader } from "../../src/services/visual-studio.reader.ts";
import { SupervisedTerminals } from "../fixtures/supervised-terminals.fixture.ts";

const CMD: string = "C:\\Windows\\System32\\cmd.exe";
const WINDOWS_ONLY: string = "Command Prompt, Visual Studio's developer shells and WSL run only on Windows.";
const RUN_MS: number = 30_000;

class OneShotRun {
  public readonly output: string;
  public readonly exitCode: number | undefined;

  public constructor(output: string, exitCode: number | undefined) {
    this.output = output;
    this.exitCode = exitCode;
  }
}

class ShellCheck {
  public readonly command: string;
  public readonly expected: (shell: Shell) => RegExp;

  public constructor(command: string, expected: (shell: Shell) => RegExp) {
    this.command = command;
    this.expected = expected;
  }
}

describe("OneShotCommand with this computer's Windows shells: Command Prompt, and each Visual Studio developer shell and WSL distribution installed", () => {
  const environment: Record<string, string> = Object.fromEntries(Object.entries(process.env).filter((t): t is [string, string] => !Object.isUndefined(t[1])));
  let terminals: SupervisedTerminals;
  let context: FakeRuntimePartContext;

  beforeAll(async () => {
    terminals = await SupervisedTerminals.createAsync();
    context = new FakeRuntimePartContext();
    context.answer("startProcessAsync", t => terminals.processes.startAsync(SupervisedTerminals.moduleId, t));
    context.answer("startPseudoTerminalAsync", t => terminals.startAsync(t));
  });

  afterAll(async () => {
    await terminals.endAsync();
  });

  async function runAsync(shell: Shell, command: string, folder: string = tmpdir()): Promise<OneShotRun> {
    const launch: OneShotLaunch = OneShotCommand.toLaunch(shell, command);
    const pty: IPtyProcess = await new ContextPtySpawner(context)
      .spawnAsync(launch.file, launch.args, folder, 200, 30, { ...environment, ...launch.environment }, false);
    const limit: AbortSignal = AbortSignal.timeout(RUN_MS);
    return await new Promise<OneShotRun>((resolve, reject) => {
      let output: string = "";
      limit.addEventListener("abort", () => reject(new Error(`${shell.id} did not exit within ${RUN_MS} ms: ${output}`)), { once: true });
      pty.onData(t => output += t);
      pty.onExit(t => resolve(new OneShotRun(output.replaceAll(/\u001b\[[0-9;?]*[A-Za-z]|\u001b\][^\u0007]*\u0007/gu, ""), t.exitCode)));
    });
  }

  async function listInstallationsAsync(): Promise<readonly string[]> {
    const programFilesX86: string | undefined = process.env["ProgramFiles(x86)"];
    if (Object.isUndefined(programFilesX86))
      return [];
    const vswhere: string = path.win32.join(programFilesX86, "Microsoft Visual Studio", "Installer", "vswhere.exe");
    if (!await new FileSystemReader().isFileAsync(vswhere))
      return [];
    const listed: unknown = JSON.parse(await new CommandRunner(context).runAsync(vswhere, ["-products", "*", "-prerelease", "-utf8", "-format", "json"], 60_000));
    assert.ok(Array.isArray(listed), `vswhere wrote ${String(listed)}`);
    return listed.map((t: unknown) => {
      assert.ok(Object.isObject(t) && "instanceId" in t && "installationVersion" in t, `vswhere listed ${JSON.stringify(t)}`);
      return `${String(t.instanceId)} ${String(t.installationVersion)}`;
    });
  }

  it("gives Command Prompt a quoted command, its operators and its escapes as they are, and its exit code", async test => {
    test.skip(process.platform !== "win32", WINDOWS_ONLY);
    const { output, exitCode }: OneShotRun = await runAsync(new Shell("cmd", "Command Prompt", TerminalShellKind.CommandPrompt, CMD, [], true),
      "echo \"a b\" & echo \"one&two\" & echo three^&four^^ & echo \"bang!\" & echo \"q^^\" & exit 3");

    assert.deepEqual(["\"a b\"", "\"one&two\"", "three&four^", "\"bang!\"", "\"q^^\""].map(t => output.includes(t)), [true, true, true, true, true],
      output);
    assert.equal(exitCode, 3);
  });

  it("runs a command after a Command Prompt's start, in a Command Prompt of its own rather than one in the terminal's folder", async test => {
    test.skip(process.platform !== "win32", WINDOWS_ONLY);
    const folder: string = await mkdtemp(path.join(tmpdir(), "one shot "));
    try {
      const start: string = path.join(folder, "start&go (x86).bat");
      await writeFile(start, ["@set NOLDOVA_PROBE=probe", ...[1, 2, 3, 4, 5].map(t => `@set "NOLDOVA_ARGUMENT_${t}=%~${t}"`), "@set NOLDOVA_ARGUMENT_",
        "@if \"!!\"==\"\" (echo DELAYED) else (echo NOT DELAYED)", ""].join("\r\n"));
      await writeFile(path.join(folder, "cmd.bat"), "@echo WRONG COMMAND PROMPT\r\n");
      const shell: Shell = new Shell("cmd-start", "Started Command Prompt", TerminalShellKind.CommandPrompt, CMD,
        ["/k", start, "-x=c^d", "a!b", "%OS%", "100%", "with space"], false);

      const { output, exitCode }: OneShotRun = await runAsync(shell, "echo \"one&two\" & echo P=%NOLDOVA_PROBE%=& echo \"Q=%NOLDOVA_PROBE%\" & echo \"100%\" & " +
        "echo bang! & echo caret^^ & echo \"bang!\" & echo \"q^^\" & if defined NOLDOVA_TERMINAL_COMMAND (echo LEAKED & exit 6) else (echo CLEAN & exit 5)",
        folder);

      assert.deepEqual(["NOLDOVA_ARGUMENT_1=-x=c^d", "NOLDOVA_ARGUMENT_2=a!b", "NOLDOVA_ARGUMENT_3=Windows_NT", "NOLDOVA_ARGUMENT_4=100%",
        "NOLDOVA_ARGUMENT_5=with space", "NOT DELAYED"].map(t => output.includes(t)), [true, true, true, true, true, true], output);
      assert.deepEqual(["\"one&two\"", "P=probe=", "\"Q=probe\"", "\"100%\"", "bang!", "caret^", "\"bang!\"", "\"q^^\"", "CLEAN", "WRONG"]
        .map(t => output.includes(t)), [true, true, true, true, true, true, true, true, true, false], output);
      assert.equal(exitCode, 5, output);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

  it("runs no command after a Command Prompt's start that fails, and ends with the start's exit code", async test => {
    test.skip(process.platform !== "win32", WINDOWS_ONLY);
    const folder: string = await mkdtemp(path.join(tmpdir(), "one shot "));
    try {
      const start: string = path.join(folder, "failing start.bat");
      await writeFile(start, "@echo STARTED\r\n@exit /b 3\r\n");
      const shell: Shell = new Shell("cmd-failing", "Failing Command Prompt", TerminalShellKind.CommandPrompt, CMD, ["/k", start], false);

      const { output, exitCode }: OneShotRun = await runAsync(shell, "echo RAN^:YES & exit 5", folder);

      assert.deepEqual(["STARTED", "RAN:YES"].map(t => output.includes(t)), [true, false], output);
      assert.equal(exitCode, 3, output);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

  it("runs a command after each developer shell's start, with its variables, and in each WSL distribution, with its exit code", async test => {
    test.skip(process.platform !== "win32", WINDOWS_ONLY);
    const listed: readonly string[] = await listInstallationsAsync();
    const runner: CommandRunner = new CommandRunner(context);
    const located: readonly Shell[] = await new ShellLocator(process.platform, process.arch, process.env, null, new FileSystemReader(), runner, new FakeModuleLog())
      .locateAsync();
    const installations: readonly VisualStudioInstallation[] = await new VisualStudioReader(runner, new FileSystemReader(), process.env["ProgramFiles(x86)"]).readAsync();
    const shells: readonly Shell[] = located.filter(t => t.kind === TerminalShellKind.Wsl || t.id.startsWith("vs-"));
    const checks: ReadonlyMap<TerminalShellKind, ShellCheck> = new Map([
      [TerminalShellKind.CommandPrompt, new ShellCheck("echo \"one&two\" & echo VS=%VSCMD_VER%= & echo \"Q=%VSCMD_VER%\" & echo \"100%\" & echo bang! & echo caret^^ & " +
        "echo \"bang!\" & echo \"q^^\" & exit 5",
        () => /"one&two"[\s\S]*VS=\d+\.\d+[\s\S]*"Q=\d+\.\d+[\s\S]*"100%"[\s\S]*bang![\s\S]*caret\^[\s\S]*"bang!"[\s\S]*"q\^\^"/u)],
      [TerminalShellKind.PowerShell, new ShellCheck("Write-Output \"one&two VS=$env:VSCMD_VER=\"; exit 5", () => /one&two VS=\d+\.\d+/u)],
      [TerminalShellKind.Wsl, new ShellCheck("echo \"one&two\"; echo \"WSL=$WSL_DISTRO_NAME=\"; exit 5", (t: Shell) => new RegExp(`one&two[\\s\\S]*WSL=${t.name}=`, "u"))]
    ]);

    await test.annotate(`Visual Studio installations and versions: ${listed.join(", ") || "none"}.`);
    await test.annotate(`Developer and WSL shells run: ${shells.map(t => t.id).join(", ") || "none"}.`);
    if (process.env["GITHUB_ACTIONS"] === "true")
      assert.ok(listed.length > 0, "GitHub's Windows runner images have Visual Studio Build Tools, but vswhere lists no installation.");
    assert.deepEqual(installations.map(t => t.instanceId), listed.map(t => t.split(" ")[0]));
    if (listed.length > 0)
      assert.ok(shells.some(t => t.kind === TerminalShellKind.CommandPrompt) && shells.some(t => t.kind === TerminalShellKind.PowerShell),
        "vswhere lists a Visual Studio installation, but no developer shell is listed.");
    test.skip(shells.length === 0, "This computer has no Visual Studio developer shell and no WSL distribution to run.");
    for (const shell of shells) {
      const check: ShellCheck | undefined = checks.get(shell.kind);
      assert.ok(!Object.isUndefined(check), `${shell.id} is a ${shell.kind} shell, which this test has no check for.`);
      const { output, exitCode }: OneShotRun = await runAsync(shell, check.command);

      assert.match(output, check.expected(shell), `${shell.id}: ${output}`);
      assert.equal(exitCode, 5, `${shell.id}: ${output}`);
    }
  });
});
