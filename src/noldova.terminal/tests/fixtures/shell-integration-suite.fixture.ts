/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess, type SpawnSyncReturns } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { ShellClients } from "@noldova/desktop.protocol";
import { RequestContext, type IMethodHandler, type ProcessRequest } from "@noldova/desktop.runtime";
import { FakeModuleLog, FakeModuleSettings } from "@noldova/desktop.runtime/testing";
import type { JsonValue } from "@noldova/context.json";
import { TerminalAttachment, TerminalCommandAdded, TerminalCompletion, TerminalCwd, TerminalMissingCommands, TerminalOutput, TerminalReference, TerminalShellKind, TerminalShells } from "@noldova/terminal.protocol";
import { afterAll, beforeAll, describe, it, vi, type TestContext } from "vitest";

import { RuntimePart } from "../../src/api/index.ts";
import { Shell } from "../../src/models/shell.ts";
import type { ShellLaunch } from "../../src/models/shell-launch.ts";
import { Resources } from "../../src/resources.ts";
import { CommandRunner } from "../../src/services/command-runner.ts";
import { FileSystemWriter } from "../../src/services/file-system-writer.ts";
import { FileSystemReader } from "../../src/services/file-system.reader.ts";
import { FolderAccess } from "../../src/services/folder-access.ts";
import { ShellIntegration } from "../../src/services/shell-integration.ts";
import { ShellLocator } from "../../src/services/shell-locator.ts";
import { FakeRuntimePartContext } from "./fake-runtime-part-context.fixture.ts";
import { PrivateFolder } from "./private-folder.fixture.ts";
import { SupervisedTerminals } from "./supervised-terminals.fixture.ts";

const WAIT_MS: number = 20_000;
const SHELL_COLD_START_MS: number = 55_000;
const TEXT_POLL_MS: number = 100;
const OPTIONS_WAIT_MS: number = 10_000;
const OPTIONS_POLL_MS: number = 10;
const OUTPUT_TAIL: number = 1_500;
const QUIET_MS: number = 1_000;
const WORK_FOLDER: string = "work-folder";
const C1_FOLDER: string = "c1-\u009c-folder";
const ESCAPED_FOLDER: string = process.platform === "win32" ? "escaped-;-folder" : "escaped-;-\\-\t-folder";
const SCRIPT_FOLDER: string = "gone \u0219\u0434 '$(echo ran-a)' \"`echo ran-b`\" $(echo ran-c) %s \\a \u0007 ;exit";
const CMD_FOLDER: string = "gone \u0219\u0434 & echo ran-d | echo ran-e %PATH% !PATH! ^& echo ran-f (x) <y> \"z\" ;exit";
const NOTE_STYLE: RegExp = /^\u001b\[(?:2;3|3;2)m/u;
const STYLES: RegExp = /\u001b\[[\d;]*m/gu;
const MARK: RegExp = /\u001b\]6973;([A-Z]);([\da-f]{32})(?:;([^\u0007]*))?\u0007/gu;
const START_TEMP: RegExp = /\[([A-Za-z]:\\[^\]\r\n]*)\]/u;
const PRINTED_TEMP: RegExp = /<tmp=([A-Za-z]:\\[^>\r\n]*)>/u;
const POSIX_SHELL_IDS: readonly string[] = ["bash", "git-bash", "zsh"];
const POWERSHELL_IDS: readonly string[] = ["pwsh", "powershell"];
const PLAIN_SHELL_IDS: readonly string[] = ["sh", "cmd"];
const SHELL_FILES: Map<string, string> = new Map<string, string>();
const REDRAW_BINDINGS: ReadonlyMap<string, string> = new Map<string, string>([
  ["bash", "bind '\"\\C-g\": redraw-current-line'"],
  ["git-bash", "bind '\"\\C-g\": redraw-current-line'"],
  ["zsh", "bindkey '^G' reset-prompt"],
  ["pwsh", "Set-PSReadLineKeyHandler -Chord Ctrl+g -ScriptBlock { [Microsoft.PowerShell.PSConsoleReadLine]::InvokePrompt() }"],
  ["powershell", "Set-PSReadLineKeyHandler -Chord Ctrl+g -ScriptBlock { [Microsoft.PowerShell.PSConsoleReadLine]::InvokePrompt() }"]
]);
const TEST_NONCE: string = "0123456789abcdef0123456789abcdef";
const COMPLETED_NAMES: readonly string[] = ["a b", "it's", ...(process.platform === "win32" ? [] : ["say \"hi\""]), "d$x", "t`x", "e[1]", "f&g", "~root"];
let terminals: SupervisedTerminals;
const BASH_STARTUP: string = "export NOLDOVA_TEST_STARTUP=ran\nset -a\nPROMPT_COMMAND=(: :)\ntrap - DEBUG\nprintf '%s.%s' \"${BASH_VERSINFO[0]}\" \"${BASH_VERSINFO[1]}\" > ~/bash-version\n";
const ZSH_STARTUP: string = "export NOLDOVA_TEST_STARTUP=ran\nset -a\nprecmd_functions=()\npreexec_functions=()\n";
const NONCE_SEARCH: string = "& (Get-Process -Id $PID).Path -NoProfile -NonInteractive -Command { " +
  `foreach ($folder in Get-ChildItem -LiteralPath '${tmpdir().replaceAll("'", "''")}' -Directory -Filter 'noldova-terminal-*') { ` +
  "\"[searched-$($folder.Name)]\"; foreach ($file in Get-ChildItem -LiteralPath $folder.FullName -File -Filter 'nonce-*') { " +
  "\"[found-$([System.IO.File]::ReadAllText($file.FullName).Trim())]\" } } }\n";
const PROFILE_RUN_VARIABLE: string = "NOLDOVA_TEST_PROFILE_RUN";
const PROFILE_TIMES_FILE: string = "profile-times.log";
const PROFILE_RUN: string = `${process.pid}-${randomUUID()}`;
const PROFILE_GUARD: RegExp = new RegExp(`^if \\(\\$env:${PROFILE_RUN_VARIABLE} -ne '(\\d+)-[\\da-f-]{36}'\\) \\{ return \\}\\n`, "u");
const POLICY_PROFILE: string = "$NoldovaProfileRuns = @('all')\n";
const BOUND_PROFILE: string = "Set-PSReadLineKeyHandler -Key F12 -Function BeginningOfLine\n";
const PROFILE_TIMES_VARIABLE: string = "NOLDOVA_TEST_PROFILE_TIMES";
const PROFILES: readonly string[] = [
  `${profileTime("first")}${NONCE_SEARCH}${profileTime("searched")}$NoldovaProfileRuns = @('all')\nthrow 'The first profile failed.'\n`,
  `${profileTime("second")}$NoldovaProfileRuns += 'host'\nfunction Get-NoldovaProfileRuns { $NoldovaProfileRuns -join ',' }\n${profileTime("ended")}`
];

class ShellMarkView {
  public readonly kind: string;
  public readonly nonce: string;
  public readonly value: string | null;

  public constructor(kind: string, nonce: string, value: string | null) {
    this.kind = kind;
    this.nonce = nonce;
    this.value = value;
  }
}

class RuntimeFixture {
  public readonly context: FakeRuntimePartContext = new FakeRuntimePartContext();
  public readonly part: RuntimePart = new RuntimePart();

  public constructor() {
    this.context.answer("startPseudoTerminalAsync", t => terminals.startAsync(t));
  }

  public text(sessionId: string): string {
    return (this.context.events.get("terminal.output")?.published ?? [])
      .map(t => TerminalOutput.fromJson(t))
      .filter(t => t.sessionId === sessionId)
      .map(t => t.data)
      .join("");
  }

  public cwds(sessionId: string): readonly string[] {
    return (this.context.events.get("terminal.cwdChanged")?.published ?? [])
      .map(t => TerminalCwd.fromJson(t))
      .filter(t => t.sessionId === sessionId)
      .map(t => t.cwd);
  }

  public async assertCwdAsync(sessionId: string): Promise<void> {
    const cwds: readonly string[] = this.cwds(sessionId);
    assert.ok(cwds.length === 1 && cwds[0]?.endsWith(WORK_FOLDER) === true, `The working folders sent were ${JSON.stringify(cwds)}.`);
    const attachment: TerminalAttachment = TerminalAttachment.fromJson(await this.callAsync("terminal.attach", { sessionId, paneId: "p1" }));
    assert.equal(attachment.cwd, cwds[0]);
  }

  public commandsAdded(sessionId: string): readonly string[] {
    return (this.context.events.get("terminal.commandAdded")?.published ?? [])
      .map(t => TerminalCommandAdded.fromJson(t))
      .filter(t => t.sessionId === sessionId)
      .map(t => t.command);
  }

  public marks(sessionId: string): readonly ShellMarkView[] {
    return [...this.text(sessionId).matchAll(MARK)].map(t => new ShellMarkView(t[1] ?? "", t[2] ?? "", t[3] ?? null));
  }

  public kinds(sessionId: string): string {
    return this.marks(sessionId).map(t => t.kind).join("");
  }

  public async callAsync(method: string, payload: JsonValue): Promise<JsonValue> {
    const handler: IMethodHandler | undefined = this.context.methods.get(method);
    assert.ok(handler !== undefined, `The part has no method ${method}.`);
    return handler.handleAsync(new RequestContext(ShellClients.mainProcess, payload, new AbortController().signal, 1, 1));
  }

  public async shellIdsAsync(): Promise<readonly string[]> {
    return TerminalShells.fromJson(await this.callAsync("terminal.shells", null)).shells.map(t => t.id);
  }

  public async openAsync(shellId: string, folder: string): Promise<string> {
    return TerminalReference.fromJson(await this.callAsync("terminal.open", { shellId, folder, size: { cols: 400, rows: 30 }, storedLimit: 104_857_600 })).sessionId;
  }

  public async typeAsync(sessionId: string, data: string): Promise<void> {
    await this.callAsync("terminal.input", { sessionId, data });
  }

  public async waitForAsync(sessionId: string, check: (text: string) => boolean, description: string, timeoutMilliseconds: number = WAIT_MS): Promise<void> {
    await vi.waitFor(() => {
      const text: string = this.text(sessionId);
      assert.ok(check(text), `${description} Marks: ${this.kinds(sessionId)}. Output ends with: ${JSON.stringify(text.slice(-OUTPUT_TAIL))}`);
    }, { timeout: timeoutMilliseconds, interval: TEXT_POLL_MS });
  }

  public async waitForQuietAsync(sessionId: string): Promise<void> {
    let length: number = -1;
    let since: number = 0;
    await vi.waitFor(() => {
      const current: number = this.text(sessionId).length;
      if (current !== length) {
        length = current;
        since = Date.now();
      }
      assert.ok(Date.now() - since >= QUIET_MS, "The shell's output did not settle.");
    }, { timeout: WAIT_MS, interval: TEXT_POLL_MS });
  }
}

export function defineShellIntegrationTests(covered: readonly string[]): void {
  beforeAll(async () => {
    terminals = await SupervisedTerminals.createAsync();
  });

  afterAll(async () => {
    await terminals.endAsync();
  });

  describe("shell integration with real shells", () => defineRealShellTests(covered));
  if (covered.includes(process.platform === "win32" ? "powershell" : "bash"))
    describe("a shell's nonce file", defineNonceFileTests);
  if (covered.includes("pwsh"))
    describe("the Store install of PowerShell 7", defineStoreInstallTests);
  const policyShells: readonly string[] = POWERSHELL_IDS.filter(t => covered.includes(t));
  if (policyShells.length > 0)
    describe("a PowerShell under the Restricted execution policy", () => defineRestrictedPolicyTests(policyShells));
  if (covered.includes("powershell"))
    describe("a PowerShell profile another PowerShell is reading", defineReadProfileTests);
}

function defineRealShellTests(covered: readonly string[]): void {
  const posixShells: readonly string[] = POSIX_SHELL_IDS.filter(t => covered.includes(t));
  const powerShells: readonly string[] = POWERSHELL_IDS.filter(t => covered.includes(t));
  const plainShells: readonly string[] = PLAIN_SHELL_IDS.filter(t => covered.includes(t));
  const fixture: RuntimeFixture = new RuntimeFixture();
  let folder: string = "";
  let workFolder: string = "";
  let home: string = "";
  let shellIds: readonly string[] = [];
  let warmings: ReadonlyMap<string, Promise<void>> = new Map<string, Promise<void>>();

  async function openWithProfilesAsync(shellId: string): Promise<string> {
    const times: string = join(folder, PROFILE_TIMES_FILE);
    await writeFile(times, "", "utf8");
    const opened: string = new Date().toISOString();
    const sessionId: string = await fixture.openAsync(shellId, workFolder);
    try {
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
    }
    catch (error: unknown) {
      if (!(error instanceof Error))
        throw error;
      const written: string = (await readFile(times, "utf8").catch(() => "")).trim().replaceAll(/\r?\n/gu, ", ");
      assert.fail(`${error.message} The terminal opened at ${opened}, and its profiles wrote: ${written === "" ? "nothing" : written}.`);
    }
    return sessionId;
  }

  beforeAll(async () => {
    folder = await mkdtemp(join(tmpdir(), "noldova-terminal-integration-"));
    home = join(folder, "home");
    workFolder = join(folder, WORK_FOLDER);
    await mkdir(home);
    await mkdir(workFolder);
    await writeFile(join(home, ".bashrc"), BASH_STARTUP, "utf8");
    await writeFile(join(home, ".bash_profile"), ". ~/.bashrc\n", "utf8");
    await writeFile(join(home, ".zshrc"), ZSH_STARTUP, "utf8");
    vi.stubEnv("HOME", home);
    vi.stubEnv("ZDOTDIR", undefined);
    vi.stubEnv(PROFILE_RUN_VARIABLE, PROFILE_RUN);
    vi.stubEnv(PROFILE_TIMES_VARIABLE, join(folder, PROFILE_TIMES_FILE));
    vi.stubEnv("PSExecutionPolicyPreference", "RemoteSigned");
    vi.stubEnv("NO_COLOR", undefined);
    await fixture.part.activateAsync(fixture.context);
    shellIds = await fixture.shellIdsAsync();
    const located: readonly Shell[] = await new ShellLocator(process.platform, process.arch, process.env, null, new FileSystemReader(),
      new CommandRunner(fixture.context), new FakeModuleLog()).locateAsync();
    for (const shell of located)
      SHELL_FILES.set(shell.id, shell.file);
    if (process.platform === "win32")
      warmings = new Map(powerShells.filter(t => shellIds.includes(t)).map(t => [t, warmModuleCacheAsync(t)]));
    for (const warming of warmings.values())
      void warming.catch(() => undefined);
  });

  afterAll(async () => {
    await Promise.allSettled(warmings.values());
    await fixture.part.deactivateAsync();
    vi.unstubAllEnvs();
    await rm(folder, { force: true, recursive: true });
  });

  for (const shellId of posixShells)
    it(`[${shellId}] marks ${shellId}'s prompts and commands after the person's startup files`, async context => {
      context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
      const sessionId: string = await fixture.openAsync(shellId, workFolder);
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
      await fixture.waitForQuietAsync(sessionId);
      const nonce: string = fixture.marks(sessionId)[0]?.nonce ?? "";
      assert.deepEqual(await nonceFilesAsync(nonce), [], "The shell's nonce file stayed.");

      await fixture.typeAsync(sessionId, "echo \"[startup-$NOLDOVA_TEST_STARTUP] [nonce-$NOLDOVA_TERMINAL_NONCE_FILE]\"; (exit 3)\r");

      await fixture.waitForAsync(sessionId, () => /C.*D/u.test(fixture.kinds(sessionId)), "No command end mark arrived.", 2 * WAIT_MS);
      assertMarks(fixture.marks(sessionId), "3");
      await fixture.assertCwdAsync(sessionId);
      await fixture.waitForAsync(sessionId, t => t.includes("[startup-ran] [nonce-]"), "The startup files did not run or the nonce file's path stayed set.");
      await fixture.typeAsync(sessionId, `echo "[child-$(env | grep -c ${nonce})]"\r`);
      await fixture.waitForAsync(sessionId, t => t.includes("[child-0]"), "The shell's programs inherit its nonce.");
      const zsh: boolean = shellId === "zsh";
      await fixture.typeAsync(sessionId, zsh ? "export PS1\r" : `export PS1 PS0; echo "[line-$(env | grep -c ${nonce})]"\r`);
      if (!zsh)
        await fixture.waitForAsync(sessionId, t => t.includes("[line-0]"), "The line that exports bash's prompts hands its nonce on.");
      await fixture.typeAsync(sessionId, `echo "[exported-$(env | grep -c ${nonce})]"\r`);
      await fixture.waitForAsync(sessionId, t => t.includes("[exported-0]"), "An exported prompt hands the shell's nonce on.");
      if (process.platform === "linux") {
        await fixture.typeAsync(sessionId, `echo "[environ-$(tr '\\0' '\\n' < /proc/$$/environ | grep -c ${nonce})]"\r`);
        await fixture.waitForAsync(sessionId, t => t.includes("[environ-0]"), "The shell's starting environment holds its nonce.");
      }
      await fixture.callAsync("terminal.close", { sessionId });
    });

  for (const shellId of posixShells.filter(t => t !== "zsh"))
    it(`[${shellId}] marks ${shellId}'s prompts with promptvars off, once after it turns on, and keeps an exported PS1 from programs`, async context => {
      context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
      await writeFile(join(home, ".bashrc"), `shopt -u promptvars\n${BASH_STARTUP}`, "utf8");
      try {
        const sessionId: string = await fixture.openAsync(shellId, workFolder);
        await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
        await fixture.waitForQuietAsync(sessionId);
        const nonce: string = fixture.marks(sessionId)[0]?.nonce ?? "";

        await fixture.typeAsync(sessionId, "echo \"[promptvars-$(shopt -q promptvars && echo on || echo off)]\"; (exit 3)\r");

        await fixture.waitForAsync(sessionId, () => /C.*D/u.test(fixture.kinds(sessionId)), "No command end mark arrived.", 2 * WAIT_MS);
        assertMarks(fixture.marks(sessionId), "3");
        await fixture.waitForAsync(sessionId, t => t.includes("[promptvars-off]"), "promptvars stayed on.");
        await fixture.typeAsync(sessionId, "export PS1\r");
        await fixture.typeAsync(sessionId, `echo "[exported-$(env | grep -c ${nonce})]"\r`);
        await fixture.waitForAsync(sessionId, t => t.includes("[exported-0]"), "An exported prompt hands the shell's nonce on.");
        await fixture.typeAsync(sessionId, "shopt -s promptvars\r");
        await fixture.typeAsync(sessionId, "echo \"[promptvars-$(shopt -q promptvars && echo on || echo off)]\"\r");
        await fixture.waitForAsync(sessionId, t => t.includes("[promptvars-on]"), "promptvars stayed off.");
        await fixture.waitForQuietAsync(sessionId);
        assert.doesNotMatch(fixture.kinds(sessionId), /AA|BB/u, "Turning promptvars on added the prompt's marks twice.");
        await fixture.callAsync("terminal.close", { sessionId });
      }
      finally {
        await writeFile(join(home, ".bashrc"), BASH_STARTUP, "utf8");
      }
    });

  for (const shellId of posixShells)
    it(`[${shellId}] marks the end of a ${shellId} command line that starts with a subshell with its code, its start where the shell runs a hook for it, and no end for an empty line`, async context => {
      context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
      const sessionId: string = await fixture.openAsync(shellId, workFolder);
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
      await fixture.waitForQuietAsync(sessionId);
      const hasStart: boolean = shellId === "zsh" || await hasPs0Async(join(home, "bash-version"));

      await fixture.typeAsync(sessionId, "(exit 4)\r");

      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("D"), "No command end mark arrived.", 2 * WAIT_MS);
      await fixture.waitForAsync(sessionId, () => /D.*B/u.test(fixture.kinds(sessionId)), "No prompt followed the command.", 2 * WAIT_MS);
      const marks: readonly ShellMarkView[] = fixture.marks(sessionId);
      const kinds: string = marks.map(t => t.kind).join("");
      if (hasStart)
        assertMarks(marks, "4");
      else
        assert.match(kinds, /^LP{0,6}AB[^C]*PDAB/u);
      assert.equal(marks.find(t => t.kind === "D")?.value, "4");
      const prompts: number = kinds.split("B").length;
      await fixture.typeAsync(sessionId, "\r");
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).split("B").length > prompts, "No prompt followed the empty line.", 2 * WAIT_MS);
      assert.equal(fixture.kinds(sessionId).split("D").length - 1, 1, `An empty line ended a command. Marks: ${fixture.kinds(sessionId)}.`);
      await fixture.callAsync("terminal.close", { sessionId });
    });

  for (const shellId of posixShells.filter(t => t !== "zsh"))
    it(`[${shellId}] sends no end mark again after a subshell's once the person's PROMPT_COMMAND replaces the integration's hooks`, async context => {
      context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
      const sessionId: string = await fixture.openAsync(shellId, workFolder);
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
      await fixture.waitForQuietAsync(sessionId);
      const promptsAfter = (count: number): (() => boolean) => () => fixture.kinds(sessionId).split("B").length > count;

      await fixture.typeAsync(sessionId, "(exit 3)\r");
      await fixture.waitForAsync(sessionId, () => /D.*B/u.test(fixture.kinds(sessionId)), "No prompt followed the subshell's end.", 2 * WAIT_MS);
      const ended: string = fixture.kinds(sessionId);
      const prompts: number = ended.split("B").length;
      await fixture.typeAsync(sessionId, "unset PROMPT_COMMAND; PROMPT_COMMAND=:\r");
      await fixture.waitForAsync(sessionId, promptsAfter(prompts), "No prompt followed the line that replaces PROMPT_COMMAND.", 2 * WAIT_MS);
      await fixture.typeAsync(sessionId, "true\r");
      await fixture.waitForAsync(sessionId, promptsAfter(prompts + 1), "No prompt followed true.", 2 * WAIT_MS);
      await fixture.waitForQuietAsync(sessionId);

      const ends: readonly ShellMarkView[] = fixture.marks(sessionId).filter(t => t.kind === "D");
      assert.deepEqual(ends.map(t => t.value), ["3"], `A later prompt sent an end mark again. Marks: ${fixture.kinds(sessionId)}.`);
      await fixture.callAsync("terminal.close", { sessionId });
    });

  for (const shellId of posixShells)
    it(`[${shellId}] marks the end of ${shellId}'s continuation prompt, once for each line a command goes on to`, async context => {
      context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
      const sessionId: string = await fixture.openAsync(shellId, workFolder);
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
      await fixture.waitForQuietAsync(sessionId);
      const marked: number = fixture.kinds(sessionId).length;

      await fixture.typeAsync(sessionId, "echo 'a\r");
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).slice(marked).endsWith("F"), "No continuation mark arrived.", 2 * WAIT_MS);
      await fixture.typeAsync(sessionId, "b\r");
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).slice(marked).endsWith("FF"), "No second continuation mark arrived.", 2 * WAIT_MS);
      await fixture.typeAsync(sessionId, "c'\r");

      await fixture.waitForAsync(sessionId, () => /FFC.*D/u.test(fixture.kinds(sessionId).slice(marked)), "No command end mark arrived.", 2 * WAIT_MS);
      await fixture.callAsync("terminal.close", { sessionId });
    });

  for (const shellId of powerShells)
    it(`[${shellId}] marks ${shellId}'s prompts and commands after the person's profiles`, async context => {
      context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
      const sessionId: string = await fixture.openAsync(shellId, workFolder);
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
      await fixture.waitForQuietAsync(sessionId);
      assert.deepEqual(await nonceFilesAsync(fixture.marks(sessionId)[0]?.nonce ?? ""), [], "The shell's nonce file stayed.");

      await fixture.typeAsync(sessionId, "\"[nonce-$env:NOLDOVA_TERMINAL_NONCE_FILE]\"; gi nx\r");

      await fixture.waitForAsync(sessionId, () => /C.*D/u.test(fixture.kinds(sessionId)), "No command end mark arrived.", 2 * WAIT_MS);
      assertMarks(fixture.marks(sessionId), "1");
      await fixture.assertCwdAsync(sessionId);
      await fixture.waitForAsync(sessionId, t => t.includes("[nonce-]"), "The nonce file's path stayed set.");
      await fixture.callAsync("terminal.close", { sessionId });
    });

  for (const shellId of powerShells)
    it(`[${shellId}] runs ${shellId}'s profiles in order, at the global scope, after reading its nonce file`, async context => {
      context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
      await withProfilesAsync(context, shellId, PROFILES, async () => {
        const sessionId: string = await openWithProfilesAsync(shellId);
        await fixture.waitForQuietAsync(sessionId);

        await fixture.typeAsync(sessionId, "\"[runs-$(Get-NoldovaProfileRuns)]\"; gi nx\r");

        await fixture.waitForAsync(sessionId, () => /C.*D/u.test(fixture.kinds(sessionId)), "No command end mark arrived.", 2 * WAIT_MS);
        assertMarks(fixture.marks(sessionId), "1");
        await fixture.waitForAsync(sessionId, t => t.includes("[runs-all,host]"), "The profiles did not both run at the global scope.");
        const text: string = fixture.text(sessionId);
        const folders: readonly string[] = await integrationFoldersAsync();
        assert.ok(folders.some(t => text.includes(`[searched-${t}]`)),
          `The first profile's program didn't search the integration folder, one of ${folders.join(", ")}.`);
        assert.ok(text.includes("The first profile failed."), "The first profile's error was not written.");
        assert.equal(text.includes(`[found-${fixture.marks(sessionId)[0]?.nonce ?? ""}]`), false, "A program a profile started read the nonce file.");
        await fixture.callAsync("terminal.close", { sessionId });
      });
    });

  for (const shellId of [...posixShells, ...powerShells])
    it(`[${shellId}] reports ${shellId}'s working folder whole when its name holds U+009C`, async context => {
      context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
      await mkdir(join(workFolder, C1_FOLDER), { recursive: true });
      const sessionId: string = await fixture.openAsync(shellId, workFolder);
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
      await fixture.waitForQuietAsync(sessionId);

      await fixture.typeAsync(sessionId, POWERSHELL_IDS.includes(shellId) ? "cd \"c1-$([char] 0x9c)-folder\"\r" : "cd \"$(printf 'c1-\\302\\234-folder')\"\r");

      await fixture.waitForAsync(sessionId, () => fixture.cwds(sessionId).some(t => t.endsWith(C1_FOLDER)), "No working folder ended with the folder's whole name.", 2 * WAIT_MS);
      await fixture.callAsync("terminal.close", { sessionId });
    });

  for (const shellId of posixShells)
    it(`[${shellId}] reports ${shellId}'s working folder whole when its name holds the mark's separator, and a backslash and a tab where the system allows them`,
      async context => {
        context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
        await mkdir(join(workFolder, ESCAPED_FOLDER), { recursive: true });
        const sessionId: string = await fixture.openAsync(shellId, workFolder);
        await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
        await fixture.waitForQuietAsync(sessionId);

        await fixture.typeAsync(sessionId, "cd escaped-*-folder\r");

        await fixture.waitForAsync(sessionId, () => fixture.cwds(sessionId).some(t => t.endsWith(ESCAPED_FOLDER)), "No working folder ended with the folder's whole name.",
          2 * WAIT_MS);
        await fixture.callAsync("terminal.close", { sessionId });
      });

  for (const shellId of [...posixShells, ...powerShells])
    it(`[${shellId}] shows a missing folder's note as written, dim and italic, on the rows above ${shellId}'s first prompt`, async context => {
      context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
      const missing: string = join(folder, SCRIPT_FOLDER);
      const sessionId: string = await fixture.openAsync(shellId, missing);
      const word: string = `after-note-${randomUUID().slice(0, 8)}`;

      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
      await fixture.typeAsync(sessionId, `echo ${word.slice(0, -1)}'${word.slice(-1)}'\r`);
      await fixture.waitForAsync(sessionId, t => t.includes(word), "The shell did not echo.");
      const attachment: TerminalAttachment = TerminalAttachment.fromJson(await fixture.callAsync("terminal.attach", { sessionId, paneId: "p1" }));

      const note: string = `The folder ${missing.replaceAll("\u0007", "?")} does not exist, so this terminal opened in the home folder.`;
      const text: string = attachment.snapshot.replace(STYLES, "");
      const noteStart: number = text.replaceAll("\r\n", "").indexOf(note);
      assert.match(attachment.snapshot, NOTE_STYLE);
      assert.equal(noteStart, 0, `The note is not the terminal's first rows: ${JSON.stringify(text)}`);
      const rows: string[] = text.split("\r\n");
      const noteEnd: number = rows.findIndex((_, i) => rows.slice(0, i + 1).join("").length >= note.length);
      const typedRow: number = rows.findIndex(t => t.includes(`echo ${word.slice(0, -1)}`));
      assert.ok(noteEnd < typedRow && rows[noteEnd]?.endsWith("home folder.") === true, `The prompt is not below the note: ${JSON.stringify(text)}`);
      assert.doesNotMatch(text.replaceAll("\r\n", ""), /(?<!echo )ran-[abc]/u, "The folder's name ran as script.");
      const powerShell: boolean = POWERSHELL_IDS.includes(shellId);
      await fixture.typeAsync(sessionId, powerShell
        ? "\"[note-$env:NOLDOVA_TERMINAL_NOTE] [child-$(& (Get-Process -Id $PID).Path -NoProfile -Command '$env:NOLDOVA_TERMINAL_NOTE')]\"\r"
        : "echo \"[note-${NOLDOVA_TERMINAL_NOTE-}] [child-$(env | grep -c NOLDOVA_TERMINAL_NOTE)]\"\r");
      await fixture.waitForAsync(sessionId, t => t.includes(powerShell ? "[note-] [child-]" : "[note-] [child-0]"),
        "The shell or its programs hold the note's variable.");
      await fixture.callAsync("terminal.close", { sessionId });
    });

  for (const shellId of powerShells)
    it(`[${shellId}] writes the note in ${shellId} under ConstrainedLanguage and removes its variable`, context => {
      context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
      const script: string =
        `$ExecutionContext.SessionState.LanguageMode = 'ConstrainedLanguage'\n${Resources.shellIntegrationPowerShellNote}\n"[gone-$env:NOLDOVA_TERMINAL_NOTE]"`;

      const result: SpawnSyncReturns<string> = spawnSync(executableOf(shellId), ["-NoProfile", "-NonInteractive", "-Command",
        script], { encoding: "utf8", timeout: WAIT_MS, env: { ...process.env, NOLDOVA_TERMINAL_NOTE: "a terminal's note" } });

      assert.equal(result.stderr, "");
      assert.equal(result.stdout.trim(), "a terminal's note[gone-]");
    });

  if (covered.includes("cmd")) {
    it("[cmd] shows a missing folder's note as written, dim and italic, on the rows above Command Prompt's first prompt",
      async context => {
        context.skip(!shellIds.includes("cmd"), "cmd is not installed.");
        const missing: string = join(folder, CMD_FOLDER);
        const sessionId: string = await fixture.openAsync("cmd", missing);
        const word: string = `after-note-${randomUUID().slice(0, 8)}`;

        await fixture.typeAsync(sessionId, `echo ${word.slice(0, -1)}^${word.slice(-1)}\r`);
        await fixture.waitForAsync(sessionId, t => t.includes(word), "The shell did not echo.");
        const attachment: TerminalAttachment = TerminalAttachment.fromJson(await fixture.callAsync("terminal.attach", { sessionId, paneId: "p1" }));

        const note: string = `The folder ${missing} does not exist, so this terminal opened in the home folder.`;
        const text: string = attachment.snapshot.replace(STYLES, "");
        assert.match(attachment.snapshot, NOTE_STYLE);
        assert.equal(text.replaceAll("\r\n", "").indexOf(note), 0, `The note is not the terminal's first rows: ${JSON.stringify(text)}`);
        const rows: string[] = text.split("\r\n");
        const noteEnd: number = rows.findIndex((_, i) => rows.slice(0, i + 1).join("").length >= note.length);
        const typedRow: number = rows.findIndex(t => t.includes(`echo ${word.slice(0, -1)}`));
        assert.ok(noteEnd < typedRow && rows[noteEnd]?.endsWith("home folder.") === true, `The prompt is not below the note: ${JSON.stringify(text)}`);
        assert.doesNotMatch(text.replaceAll("\r\n", ""), /(?<!echo )ran-[def]/u, "The folder's name ran as commands.");
        const held: string = "[child-%NOLDOVA_TERMINAL_NOTE%]";
        await fixture.typeAsync(sessionId, `cmd /d /c echo ${held}\r`);
        await fixture.waitForAsync(sessionId, t => t.split(held).length > 2, "The shell or its programs hold the note's variable.");
        await fixture.callAsync("terminal.close", { sessionId });
      });

    for (const expansion of ["/v:off", "/v:on"])
      it(`has Command Prompt write a note as it is, and clear its variable, with delayed expansion ${expansion.slice(3)}`, context => {
        context.skip(process.platform !== "win32", "Command Prompt runs on Windows only.");
        const commandPrompt: string = join(process.env["SystemRoot"] ?? "", "System32", "cmd.exe");
        const note: string = "\u001b[2;3mThe folder C:\\a & echo ran-x | %PATH% !PATH! ^& (y) <z> \"q\" does not exist.\u001b[0m";
        const line: string = Resources.formatCmdNoteLine(commandPrompt, "NOLDOVA_TERMINAL_NOTE",
          `"${commandPrompt}" /d /c echo [gone-%NOLDOVA_TERMINAL_NOTE^%]`).replace("/s /k", "/s /c");

        const result: SpawnSyncReturns<string> = spawnSync(commandPrompt, [`/d ${expansion} ${line}`],
          { encoding: "utf8", timeout: WAIT_MS, windowsVerbatimArguments: true, env: { ...process.env, NOLDOVA_TERMINAL_NOTE: note } });

        assert.equal(result.stderr, "");
        assert.equal(result.stdout, `${note}\r\n[gone-%NOLDOVA_TERMINAL_NOTE%]\r\n`);
      });
  }

  for (const shellId of [...posixShells, ...powerShells])
    it(`[${shellId}] keeps each ${shellId} command a person starts for every terminal of that shell, and tells where the line starts at its prompt`,
      async context => {
        context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
        const sessionId: string = await fixture.openAsync(shellId, workFolder);
        const other: string = await fixture.openAsync(shellId, workFolder);
        await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
        await fixture.waitForQuietAsync(sessionId);

        await fixture.typeAsync(sessionId, "echo noldova-317\r");
        await vi.waitFor(() => assert.deepEqual([fixture.commandsAdded(sessionId), fixture.commandsAdded(other)],
          [["echo noldova-317"], ["echo noldova-317"]]), { timeout: WAIT_MS, interval: TEXT_POLL_MS });
        await fixture.waitForAsync(sessionId, () => /C[^B]*B[^C]*$/u.test(fixture.kinds(sessionId)), "No prompt after the command.");
        await fixture.waitForQuietAsync(sessionId);
        await fixture.typeAsync(sessionId, "echo nol");
        await fixture.waitForAsync(sessionId, t => t.slice(t.lastIndexOf("\u0007")).replace(STYLES, "").includes("echo nol"), "The typed text was not echoed.");
        await fixture.waitForQuietAsync(sessionId);
        const typing: TerminalAttachment = TerminalAttachment.fromJson(await fixture.callAsync("terminal.attach", { sessionId, paneId: "p1" }));

        assert.equal(typing.input?.rowsAbove, 0);
        assert.ok((typing.input?.column ?? 0) > 0, `The line starts at ${JSON.stringify(typing.input?.toJson() ?? null)}.`);
        assert.equal(typing.commands[0], "echo noldova-317");
        await fixture.typeAsync(sessionId, "\u0003");
        if (shellId === "pwsh") {
          await fixture.waitForQuietAsync(sessionId);
          await fixture.typeAsync(sessionId, "\"[prediction-$((Get-PSReadLineOption).PredictionSource)]\"\r");
          await fixture.waitForAsync(sessionId, t => /\[prediction-(?!None\])\w+\]/u.test(t), "PSReadLine's own predictions were turned off.");
        }
        await fixture.callAsync("terminal.close", { sessionId });
        await fixture.callAsync("terminal.close", { sessionId: other });
      });

  for (const shellId of [...posixShells, ...powerShells])
    it(`[${shellId}] reads a ${shellId} command over several lines by its first line, and the line again from where a prompt redrawn in place starts it`,
      async context => {
        context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
        const sessionId: string = await fixture.openAsync(shellId, workFolder);
        const continuation: string = POWERSHELL_IDS.includes(shellId) ? "`" : "\\";
        const prompted: () => boolean = () => /C[^B]*B[^C]*$/u.test(fixture.kinds(sessionId));
        const waitForCommandAsync: (command: string) => Promise<void> = command => vi.waitFor(() => assert.ok(fixture.commandsAdded(sessionId).includes(command),
          `The commands kept were ${JSON.stringify(fixture.commandsAdded(sessionId))}.`), { timeout: WAIT_MS, interval: TEXT_POLL_MS });
        await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
        await fixture.waitForQuietAsync(sessionId);
        await fixture.typeAsync(sessionId, `${REDRAW_BINDINGS.get(shellId) ?? ""}\r`);
        await fixture.waitForAsync(sessionId, prompted, "No prompt after the key binding.");
        await fixture.waitForQuietAsync(sessionId);

        await fixture.typeAsync(sessionId, `echo noldova-one ${continuation}\r`);
        await fixture.waitForQuietAsync(sessionId);
        await fixture.typeAsync(sessionId, "noldova-two\r");
        await waitForCommandAsync(`echo noldova-one ${continuation}`);
        await fixture.waitForAsync(sessionId, prompted, "No prompt after the command over several lines.");
        await fixture.waitForQuietAsync(sessionId);
        await fixture.typeAsync(sessionId, "echo nol");
        await fixture.waitForAsync(sessionId, t => t.slice(t.lastIndexOf("\u0007")).replace(STYLES, "").includes("echo nol"), "The typed text was not echoed.");
        await fixture.waitForQuietAsync(sessionId);
        const marked: number = fixture.kinds(sessionId).length;
        await fixture.typeAsync(sessionId, "\u0007");
        await fixture.waitForAsync(sessionId, t => fixture.kinds(sessionId).length > marked && fixture.kinds(sessionId).endsWith("B")
          && t.slice(t.lastIndexOf("\u0007")).replace(STYLES, "").includes("echo nol"), "The prompt was not redrawn with the typed text.");
        await fixture.waitForQuietAsync(sessionId);
        await fixture.typeAsync(sessionId, "dova-redrawn\r");

        await waitForCommandAsync("echo noldova-redrawn");
        await fixture.callAsync("terminal.close", { sessionId });
      });

  for (const shellId of [...posixShells, ...powerShells])
    it(`[${shellId}] completes each name so ${shellId} reads it as itself, from a print command or PowerShell's -Path`, async context => {
      context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
      const names: string = join(folder, `names-${shellId}`);
      await mkdir(names);
      for (const name of COMPLETED_NAMES)
        await writeFile(join(names, name), "", "utf8");
      const isPowerShell: boolean = POWERSHELL_IDS.includes(shellId);
      const sessionId: string = await fixture.openAsync(shellId, names);
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
      await fixture.waitForQuietAsync(sessionId);

      for (const name of COMPLETED_NAMES) {
        const line: string = `${isPowerShell ? "Get-Item -Path " : "printf '[%s]\\n' "}${name.startsWith("~") ? "~r" : name.charAt(0)}`;
        const completion: TerminalCompletion = TerminalCompletion.fromJson(await fixture.callAsync("terminal.complete", { sessionId, line, cursor: line.length }));
        assert.deepEqual(completion.items.map(t => t.label), [name]);
        const text: string = `${line.slice(0, completion.replaceFrom)}${completion.items[0]?.text ?? ""}`;
        await fixture.typeAsync(sessionId, `${text}${isPowerShell ? " | ForEach-Object { \"[$($_.Name)]\" }" : ""}\r`);
        await fixture.waitForAsync(sessionId, t => t.includes(`[${name}]`), `${shellId} did not read ${JSON.stringify(text)} as ${JSON.stringify(name)}.`);
        await fixture.waitForQuietAsync(sessionId);
      }

      await mkdir(join(names, "g[1]"));
      await writeFile(join(names, "g[1]", "in.txt"), "", "utf8");
      const folderLine: string = isPowerShell ? "Get-Item -Path g" : "printf '[%s]\\n' g";
      const folderCompletion: TerminalCompletion = TerminalCompletion.fromJson(await fixture.callAsync("terminal.complete", { sessionId, line: folderLine, cursor: folderLine.length }));
      assert.equal(folderCompletion.items.length, 1);
      const fileLine: string = `${folderLine.slice(0, folderCompletion.replaceFrom)}${folderCompletion.items[0]?.text ?? ""}i`;
      const fileCompletion: TerminalCompletion = TerminalCompletion.fromJson(await fixture.callAsync("terminal.complete", { sessionId, line: fileLine, cursor: fileLine.length }));
      assert.deepEqual(fileCompletion.items.map(t => t.label), ["in.txt"]);
      const fileText: string = `${fileLine.slice(0, fileCompletion.replaceFrom)}${fileCompletion.items[0]?.text ?? ""}`;
      await fixture.typeAsync(sessionId, `${fileText}${isPowerShell ? " | ForEach-Object { \"[$($_.Name)]\" }" : ""}\r`);
      await fixture.waitForAsync(sessionId, t => t.includes("in.txt]"), `${shellId} did not read ${JSON.stringify(fileText)} as g[1]/in.txt.`);
      await fixture.waitForQuietAsync(sessionId);

      if (isPowerShell) {
        const nativeLine: string = `& '${process.execPath.replaceAll("'", "''")}' -e "console.log('<'+process.argv[1]+'>')" e`;
        const nativeCompletion: TerminalCompletion = TerminalCompletion.fromJson(await fixture.callAsync("terminal.complete", { sessionId, line: nativeLine, cursor: nativeLine.length }));
        assert.deepEqual(nativeCompletion.items.map(t => t.label), ["e[1]"]);
        const nativeText: string = `${nativeLine.slice(0, nativeCompletion.replaceFrom)}${nativeCompletion.items[0]?.text ?? ""}`;
        await fixture.typeAsync(sessionId, `${nativeText}\r`);
        await fixture.waitForAsync(sessionId, t => t.includes("<e[1]>"), `${shellId} did not pass ${JSON.stringify(nativeText)} to a native program as e[1].`);
        await fixture.waitForQuietAsync(sessionId);
      }
      await fixture.callAsync("terminal.close", { sessionId });
    });

  for (const shellId of [...posixShells, ...powerShells])
    it(`[${shellId}] completes ${shellId}'s commands from its PATH at the prompt, once a command changes it`, async context => {
      context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
      const bin: string = join(folder, `bin-${shellId}`);
      await mkdir(bin);
      await writeFile(join(bin, process.platform === "win32" ? "noldovaprobe.cmd" : "noldovaprobe"), process.platform === "win32" ? "@echo off\r\n" : "#!/bin/sh\n",
        { encoding: "utf8", mode: 0o755 });
      const sessionId: string = await fixture.openAsync(shellId, workFolder);
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
      await fixture.waitForQuietAsync(sessionId);
      const completeAsync = async (): Promise<readonly string[]> =>
        TerminalCompletion.fromJson(await fixture.callAsync("terminal.complete", { sessionId, line: "noldovapro", cursor: 10 })).items.map(t => t.label);
      assert.deepEqual(await completeAsync(), []);

      const changePathAsync = async (line: string): Promise<readonly string[]> => {
        const marked: number = fixture.kinds(sessionId).length;
        await fixture.typeAsync(sessionId, line);
        await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).length > marked && fixture.kinds(sessionId).endsWith("B"),
          `${shellId} did not prompt again after PATH changed.`);
        await fixture.waitForQuietAsync(sessionId);
        return completeAsync();
      };
      const added: readonly string[] = await changePathAsync(POWERSHELL_IDS.includes(shellId) ? `$env:PATH = '${bin}' + [IO.Path]::PathSeparator + $env:PATH\r`
        : `export PATH="${shellId === "git-bash" ? "$(cygpath -u '" + bin + "')" : bin}:$PATH"\r`);
      const grown: readonly string[] = await changePathAsync(POWERSHELL_IDS.includes(shellId) ? "$env:PATH = $env:PATH + [IO.Path]::PathSeparator + ('x' * 20000)\r"
        : "export PATH=\"$PATH:/$(printf '%020000d' 0)\"\r");

      assert.deepEqual([added, grown], [["noldovaprobe"], []]);
      await fixture.callAsync("terminal.close", { sessionId });
    });

  for (const shellId of [...posixShells.filter(t => t === "zsh"), ...powerShells])
    it(`[${shellId}] asks ${shellId}'s own completion for a command's options through its hidden binding, which changes neither the screen nor the history`,
      async context => {
        context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
        const isPowerShell: boolean = POWERSHELL_IDS.includes(shellId);
        const sessionId: string = await fixture.openAsync(shellId, workFolder);
        await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
        await fixture.waitForQuietAsync(sessionId);
        const promptAsync = async (line: string): Promise<void> => {
          const marked: number = fixture.kinds(sessionId).length;
          await fixture.typeAsync(sessionId, line);
          await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).length > marked && fixture.kinds(sessionId).endsWith("B"),
            `${shellId} did not prompt again.`);
          await fixture.waitForQuietAsync(sessionId);
        };
        const historyLine: string = isPowerShell ? "echo \"[history-$(@(Get-History).Count)]\"\r" : "echo \"[history-$(fc -l 1 | wc -l | tr -d ' ')]\"\r";
        await promptAsync(isPowerShell ? "function noldovaprobe { param([switch] $Alpha, [string] $Beta) }\r"
          : "autoload -Uz compinit && compinit -u -D && _noldova_probe() { compadd -- --alpha --beta gamma } && compdef _noldova_probe noldovaprobe\r");
        await promptAsync(historyLine);
        assert.equal(fixture.marks(sessionId).findLast(t => t.value?.startsWith("Options=") === true)?.value, "Options=1");
        await fixture.typeAsync(sessionId, "noldovaprobe -");
        await fixture.waitForQuietAsync(sessionId);
        const screen = async (paneId: string): Promise<string> =>
          TerminalAttachment.fromJson(await fixture.callAsync("terminal.attach", { sessionId, paneId })).snapshot;
        const before: string = await screen("p1");
        if (!isPowerShell) {
          const attached: number = fixture.kinds(sessionId).length;
          await fixture.callAsync("terminal.complete", { sessionId, line: "noldovaprobe -", cursor: 14, asksShell: true });
          await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).slice(attached).includes("O"),
            `${shellId} did not answer the ask after the attach.`, OPTIONS_WAIT_MS);
        }
        await fixture.waitForQuietAsync(sessionId);
        const marked: string = fixture.kinds(sessionId);

        const askedAt: number = performance.now();
        const completion: TerminalCompletion = TerminalCompletion.fromJson(await fixture.callAsync("terminal.complete",
          { sessionId, line: "noldovaprobe -", cursor: 14, asksShell: true }));
        const returnedIn: number = Math.round(performance.now() - askedAt);
        const optionsIn: number | null = await vi.waitFor(() => {
          assert.ok(fixture.kinds(sessionId).slice(marked.length).includes("O"));
          return Math.round(performance.now() - askedAt);
        }, { timeout: OPTIONS_WAIT_MS, interval: OPTIONS_POLL_MS }).catch(() => null);
        await fixture.waitForQuietAsync(sessionId);
        const after: string = await screen("p2");
        const answeredMarks: string = fixture.kinds(sessionId).slice(marked.length);
        const answer: string = `The completion answered in ${returnedIn} ms, and the options mark `
          + `${optionsIn === null ? `didn't come within ${OPTIONS_WAIT_MS} ms of the ask` : `came ${optionsIn} ms after the ask`}. It answered ${JSON.stringify(completion.toJson())}, with marks ${answeredMarks === "" ? "none" : answeredMarks} after `
          + `it asked and the last options mark ${JSON.stringify(fixture.marks(sessionId).findLast(t => t.kind === "O")?.value ?? null)}. `
          + `Marks: ${fixture.kinds(sessionId)}. Output ends with: ${JSON.stringify(fixture.text(sessionId).slice(-OUTPUT_TAIL))}`;
        await fixture.typeAsync(sessionId, "\u007f".repeat(14));
        await promptAsync(historyLine);
        const counts: readonly string[] = [...fixture.text(sessionId).matchAll(/\[history-(\d+)\]/gu)].map(t => t[1] ?? "");

        assert.deepEqual([completion.isShellTab, completion.items.map(t => [t.label, t.kind])],
          [false, isPowerShell ? [["-Alpha", "Option"], ["-Beta", "Option"]] : [["--alpha", "Option"], ["--beta", "Option"]]], answer);
        assert.equal(after, before, "The binding changed the screen.");
        assert.equal(answeredMarks, "O", "The binding sent marks other than its answer, such as a prompt or a command's.");
        assert.equal(Number(counts.at(-1)) - Number(counts.at(-2)), 1, `The history grew by more than the line that counts it: ${counts.join(", ")}.`);
        await fixture.callAsync("terminal.close", { sessionId });
      });

  for (const shellId of posixShells.filter(t => t !== "zsh"))
    it(`[${shellId}] registers no completion binding in ${shellId}, whose request for options sends it nothing`, async context => {
      context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
      const sessionId: string = await fixture.openAsync(shellId, workFolder);
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
      await fixture.waitForQuietAsync(sessionId);
      await fixture.typeAsync(sessionId, "echo \"[bound-$(bind -X | grep -c noldova)]\"\r");
      await fixture.waitForAsync(sessionId, t => t.includes("[bound-0]"), `${shellId} has a binding of the module's.`);
      await fixture.waitForQuietAsync(sessionId);
      await fixture.typeAsync(sessionId, "ls -");
      await fixture.waitForQuietAsync(sessionId);
      const marked: string = fixture.kinds(sessionId);

      const completion: TerminalCompletion = TerminalCompletion.fromJson(await fixture.callAsync("terminal.complete",
        { sessionId, line: "ls -", cursor: 4, asksShell: true }));
      await fixture.waitForQuietAsync(sessionId);

      assert.deepEqual([completion.isShellTab, completion.items.filter(t => t.kind === "Option")], [false, []]);
      assert.equal(fixture.kinds(sessionId), marked, "The request reached the shell.");
      assert.ok(!fixture.marks(sessionId).some(t => t.value === "Options=1"), "A prompt said a binding is in place.");
      await fixture.callAsync("terminal.close", { sessionId });
    });

  for (const shellId of [...posixShells.filter(t => t === "zsh"), ...powerShells])
    it(`[${shellId}] keeps ${shellId}'s own binding of the completion binding's key and registers none`, async context => {
      context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
      const isPowerShell: boolean = POWERSHELL_IDS.includes(shellId);
      const checkAsync = async (): Promise<void> => {
        const sessionId: string = await fixture.openAsync(shellId, workFolder);
        await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
        await fixture.waitForQuietAsync(sessionId);
        await fixture.typeAsync(sessionId, isPowerShell ? "\"[bound-$((Get-PSReadLineKeyHandler -Bound | Where-Object Key -like 'F12*').Key -join ',')]\"\r"
          : "echo \"[bound-$(bindkey '^[[24;7~' | cut -d' ' -f2)]\"\r");
        await fixture.waitForAsync(sessionId, t => t.includes(isPowerShell ? "[bound-F12]" : "[bound-beep]"), `${shellId} lost the person's binding.`);
        await fixture.waitForQuietAsync(sessionId);
        const marked: string = fixture.kinds(sessionId);

        const completion: TerminalCompletion = TerminalCompletion.fromJson(await fixture.callAsync("terminal.complete",
          { sessionId, line: "ls -", cursor: 4, asksShell: true }));
        await fixture.waitForQuietAsync(sessionId);

        assert.deepEqual([completion.isShellTab, completion.items.filter(t => t.kind === "Option")], [false, []]);
        assert.equal(fixture.kinds(sessionId), marked, "The request reached the shell.");
        assert.ok(!fixture.marks(sessionId).some(t => t.value === "Options=1"), "A prompt said a binding is in place.");
        await fixture.callAsync("terminal.close", { sessionId });
      };
      if (isPowerShell) {
        await withProfilesAsync(context, shellId, [BOUND_PROFILE], checkAsync);
        return;
      }
      await writeFile(join(home, ".zshrc"), `${ZSH_STARTUP}bindkey '^[[24;7~' beep\n`, "utf8");
      try {
        await checkAsync();
      }
      finally {
        await writeFile(join(home, ".zshrc"), ZSH_STARTUP, "utf8");
      }
    });

  for (const shellId of posixShells)
    it(`[${shellId}] finds the names ${shellId} would run, its keywords, aliases and functions too, once a prompt reports them`, async context => {
      context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
      const sessionId: string = await fixture.openAsync(shellId, workFolder);
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
      await fixture.waitForQuietAsync(sessionId);
      const findAsync = async (): Promise<readonly string[]> => TerminalMissingCommands.fromJson(await fixture.callAsync("terminal.findCommands",
        { sessionId, names: ["if", "cd", "ls", "noldovaalias", "noldovafunction", "noldovanone"] })).names;
      if (shellId === "git-bash" && !fixture.marks(sessionId).some(t => t.value?.startsWith("Names=") === true)) {
        assert.deepEqual(await findAsync(), []);
        const builtins: readonly string[] = TerminalCompletion.fromJson(await fixture.callAsync("terminal.complete", { sessionId, line: "expor", cursor: 5 }))
          .items.map(t => t.label);
        assert.deepEqual(builtins, ["export"]);
        await fixture.callAsync("terminal.close", { sessionId });
        context.skip("Git Bash before bash 5.3 sends no names, since its subshell at each prompt would be slow.");
      }
      const before: readonly string[] = await findAsync();

      const marked: number = fixture.kinds(sessionId).length;
      await fixture.typeAsync(sessionId, "alias noldovaalias=ls; noldovafunction() { :; }; _noldovahelper() { :; }\r");
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).length > marked && fixture.kinds(sessionId).endsWith("B"),
        `${shellId} did not prompt again after the names changed.`);
      await fixture.waitForQuietAsync(sessionId);

      const names: readonly string[] = (fixture.marks(sessionId).findLast(t => t.value?.startsWith("Names=") === true)?.value ?? "").split(" ");
      assert.deepEqual([before, await findAsync()], [["noldovaalias", "noldovafunction", "noldovanone"], ["noldovanone"]]);
      assert.deepEqual([names.includes("noldovafunction"), names.includes("_noldovahelper")], [true, false]);
      const completion: TerminalCompletion = TerminalCompletion.fromJson(await fixture.callAsync("terminal.complete", { sessionId, line: "noldovaf", cursor: 8 }));
      assert.deepEqual(completion.items.map(t => t.label), ["noldovafunction"]);
      await fixture.callAsync("terminal.close", { sessionId });
    });

  for (const shellId of powerShells)
    it(`[${shellId}] finds the names ${shellId} would run: a profile's function, modules' commands it never imports, a program and a name it runs with Get-`,
      async context => {
        context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
        const logged: number = fixture.context.log.callsOf("write").length;
        const modules: string = join(dirname(workFolder), `modules-${shellId}`);
        const imported: string = join(dirname(workFolder), `imported-${shellId}`);
        const marking: string = `Set-Content -LiteralPath '${imported.replaceAll("'", "''")}' -Value 'imported'\n`;
        await mkdir(join(modules, "NoldovaProbe"), { recursive: true });
        await mkdir(join(modules, "NoldovaBare"), { recursive: true });
        await writeFile(join(modules, "NoldovaProbe", "NoldovaProbe.psm1"), `${marking}function Get-NoldovaProbe { }\nfunction Invoke-NoldovaProbe { }\n`, "utf8");
        await writeFile(join(modules, "NoldovaProbe", "NoldovaProbe.psd1"),
          "@{ ModuleVersion = '1.0'; RootModule = 'NoldovaProbe.psm1'; FunctionsToExport = @('Get-NoldovaProbe', 'Invoke-NoldovaProbe') }\n", "utf8");
        await writeFile(join(modules, "NoldovaBare", "NoldovaBare.psm1"), `${marking}function Invoke-NoldovaBare { }\n`, "utf8");
        // A runner's first scan of its many modules can pass the lookup's 10 seconds, and PowerShell keeps a scan in its module analysis cache only by running on
        // about 10 seconds after it, so the cache is warmed first: this test checks which names a lookup finds, and the lookup's own late scan has its own test.
        // The warming starts in the setup, so the tests before this one run while it does.
        await warmings.get(shellId);
        await withProfilesAsync(context, shellId, PROFILES, async () => {
          const sessionId: string = await openWithProfilesAsync(shellId);
          await fixture.waitForQuietAsync(sessionId);
          const marked: number = fixture.kinds(sessionId).length;

          await fixture.typeAsync(sessionId, `$env:PSModulePath = '${modules.replaceAll("'", "''")}' + [IO.Path]::PathSeparator + $env:PSModulePath\r`);
          await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).length > marked && fixture.kinds(sessionId).endsWith("B"),
            `${shellId} did not prompt again after its PSModulePath changed.`);
          await fixture.waitForQuietAsync(sessionId);

          const requested: number = fixture.context.requests.length;
          const missing: readonly string[] = TerminalMissingCommands.fromJson(await fixture.callAsync("terminal.findCommands", { sessionId,
            names: ["Get-NoldovaProfileRuns", "NoldovaProfileRuns", "Invoke-NoldovaProbe", "NoldovaProbe", "Invoke-NoldovaBare", "whoami", "noldovanone",
              "nöldovanone"] })).names;
          const names: readonly string[] = (fixture.marks(sessionId).findLast(t => t.value?.startsWith("Names=") === true)?.value ?? "").split(" ");
          const isImported: boolean = await stat(imported).then(() => true, () => false);
          const lookups: readonly ProcessRequest[] = fixture.context.requests.slice(requested).filter(t => t.arguments.includes("-EncodedCommand"));
          const found: readonly unknown[] = [missing, names.includes("Get-NoldovaProfileRuns"), names.includes("Invoke-NoldovaProbe"), isImported];
          const written: readonly unknown[] = fixture.context.log.callsOf("write").slice(logged).map(t => t[0]);
          const notes: readonly string[] = [...missing.includes("whoami") ? [describeProgramLookups(lookups)] : [],
            ...written.length > 0 ? [`During this test the runtime logged ${JSON.stringify(written)}.`] : []];
          const expected: readonly unknown[] = [["noldovanone", "nöldovanone"], true, false, false];
          if (notes.length === 0)
            assert.deepEqual(found, expected);
          else
            assert.deepEqual(found, expected, `Got ${JSON.stringify(found)}. ${notes.join(" ")}`);
          await fixture.callAsync("terminal.close", { sessionId });
        });
      });

  for (const shellId of posixShells)
    it(`[${shellId}] never finds a folder missing under ${shellId}'s autocd, nor a file a zsh suffix alias runs`, async context => {
      context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
      const folder: string = join(dirname(workFolder), `autocd-${shellId}`);
      await mkdir(join(folder, "noldovafolder"), { recursive: true });
      const sessionId: string = await fixture.openAsync(shellId, folder);
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
      await fixture.waitForQuietAsync(sessionId);
      if (shellId === "git-bash" && !fixture.marks(sessionId).some(t => t.value?.startsWith("Names=") === true)) {
        await fixture.callAsync("terminal.close", { sessionId });
        context.skip("Git Bash before bash 5.3 sends no names, since its subshell at each prompt would be slow.");
      }
      const findAsync = async (): Promise<readonly string[]> => TerminalMissingCommands.fromJson(await fixture.callAsync("terminal.findCommands",
        { sessionId, names: ["noldovafolder", "notes.noldovasuffix", "noldovanone"] })).names;
      const before: readonly string[] = await findAsync();

      const marked: number = fixture.kinds(sessionId).length;
      const start: number = fixture.text(sessionId).length;
      await fixture.typeAsync(sessionId, shellId === "zsh" ? "setopt autocd; alias -s noldovasuffix=cat\r"
        : "shopt -s autocd 2>/dev/null || echo noldova$((6 * 7))noautocd\r");
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).length > marked && fixture.kinds(sessionId).endsWith("B"),
        `${shellId} did not prompt again after autocd turned on.`);
      await fixture.waitForQuietAsync(sessionId);
      const hasAutocd: boolean = !fixture.text(sessionId).slice(start).includes("noldova42noautocd");

      assert.deepEqual([before, await findAsync()], [["noldovafolder", "notes.noldovasuffix", "noldovanone"],
        shellId === "zsh" ? ["noldovanone"] : [...hasAutocd ? [] : ["noldovafolder"], "notes.noldovasuffix", "noldovanone"]]);
      assert.equal(fixture.text(sessionId).includes("invalid shell option"), false, `${shellId}'s prompt hook printed shopt's error.`);
      await fixture.callAsync("terminal.close", { sessionId });
    });

  for (const shellId of posixShells)
    it(`[${shellId}] keeps ${shellId}'s names list out of set -x's trace and of the environment, and leaves xtrace on for the person's commands`,
      async context => {
        context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
        const sessionId: string = await fixture.openAsync(shellId, workFolder);
        await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
        await fixture.waitForQuietAsync(sessionId);
        const marked: number = fixture.kinds(sessionId).length;
        const start: number = fixture.text(sessionId).length;

        await fixture.typeAsync(sessionId, "env | grep -c -E '^__noldova_(names|path)='; set -x; noldovatraced() { :; }\r");
        await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).length > marked && fixture.kinds(sessionId).endsWith("B"),
          `${shellId} did not prompt again after set -x.`);
        await fixture.waitForQuietAsync(sessionId);
        await fixture.typeAsync(sessionId, "echo noldova$((6 * 7))\r");
        await fixture.waitForAsync(sessionId, t => t.slice(start).split("noldova42").length > 2, `${shellId} traced no command after set -x.`);

        const text: string = fixture.text(sessionId).slice(start);
        assert.match(text, /[\n\u0007]0\r?\n/u);
        assert.deepEqual(text.split("\n").filter(t => t.startsWith("+") && (t.includes("__noldova_names") || t.includes("compgen"))), []);
        await fixture.callAsync("terminal.close", { sessionId });
      });

  if (covered.includes("git-bash")) {
    it("[git-bash] completes Git Bash's commands from its start PATH again once cygpath can't convert its PATH", async context => {
      context.skip(!shellIds.includes("git-bash"), "Git Bash is not installed.");
      const bin: string = join(folder, "bin-probe");
      const failing: string = join(folder, "bin-failing-cygpath");
      await mkdir(bin);
      await mkdir(failing);
      await writeFile(join(bin, "noldovaprobe.cmd"), "@echo off\r\n", "utf8");
      await writeFile(join(failing, "cygpath"), "#!/bin/sh\nexit 1\n", { encoding: "utf8", mode: 0o755 });
      const sessionId: string = await fixture.openAsync("git-bash", workFolder);
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
      await fixture.waitForQuietAsync(sessionId);
      const changePathAsync = async (added: string): Promise<readonly string[]> => {
        const marked: number = fixture.kinds(sessionId).length;
        await fixture.typeAsync(sessionId, `export PATH="$(cygpath -u '${added}'):$PATH"\r`);
        await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).length > marked && fixture.kinds(sessionId).endsWith("B"),
          "Git Bash did not prompt again after PATH changed.");
        await fixture.waitForQuietAsync(sessionId);
        return TerminalCompletion.fromJson(await fixture.callAsync("terminal.complete", { sessionId, line: "noldovapro", cursor: 10 })).items.map(t => t.label);
      };

      assert.deepEqual([await changePathAsync(bin), await changePathAsync(failing)], [["noldovaprobe"], []]);
      await fixture.callAsync("terminal.close", { sessionId });
    });

    it("sends no /tmp of Git Bash's own when cygpath fails at its first prompt, and completes /tmp/ in the TEMP it started with",
      async context => {
        context.skip(!shellIds.includes("git-bash") || !shellIds.includes("cmd"), "Git Bash or Command Prompt is not installed.");
        const logged: number = fixture.context.log.callsOf("write").length;
        const cmdId: string = await fixture.openAsync("cmd", workFolder);
        await fixture.typeAsync(cmdId, "echo [%TEMP%]\r");
        await fixture.waitForAsync(cmdId, t => START_TEMP.test(t), "Command Prompt did not print the TEMP a shell starts with.");
        const startTemp: string = START_TEMP.exec(fixture.text(cmdId))?.[1] ?? "";
        await fixture.callAsync("terminal.close", { sessionId: cmdId });
        const failing: string = join(folder, "bin-failing-cygpath-at-start");
        const probe: string = `noldova-temp-${randomUUID().slice(0, 8)}`;
        await mkdir(failing);
        await writeFile(join(failing, "cygpath"), "#!/bin/sh\nexit 1\n", { encoding: "utf8", mode: 0o755 });
        await writeFile(join(startTemp, probe), "", "utf8");
        await writeFile(join(home, ".bashrc"), `${BASH_STARTUP}export PATH="$(cygpath -u '${failing}'):$PATH"\n`, "utf8");
        try {
          const sessionId: string = await fixture.openAsync("git-bash", workFolder);
          await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
          await fixture.waitForQuietAsync(sessionId);

          const line: string = `printf '[%s]\\n' /tmp/${probe.slice(0, -2)}`;
          const askedAt: number = Date.now();
          const completion: TerminalCompletion = TerminalCompletion.fromJson(await fixture.callAsync("terminal.complete", { sessionId, line, cursor: line.length }));
          const answeredIn: number = Date.now() - askedAt;
          const listedAt: number = Date.now();
          const entries: readonly string[] = await readdir(startTemp);
          const listedIn: number = Date.now() - listedAt;

          assert.deepEqual(fixture.marks(sessionId).filter(t => t.value?.startsWith(Resources.temporaryFolderProperty) === true), []);
          assert.deepEqual(completion.items.map(t => t.label), [probe], `The completion answered in ${answeredIn} ms with ${JSON.stringify(completion.toJson())}. `
            + `Listing ${startTemp} after it took ${listedIn} ms and found ${entries.length} entries, the probe ${entries.includes(probe) ? "among them" : "not among them"}. `
            + `During this test the runtime logged ${JSON.stringify(fixture.context.log.callsOf("write").slice(logged))}.`);
          await fixture.callAsync("terminal.close", { sessionId });
        }
        finally {
          await writeFile(join(home, ".bashrc"), BASH_STARTUP, "utf8");
          await rm(join(startTemp, probe), { force: true });
        }
      });

    it("[git-bash] sends Git Bash's /tmp as cygpath -w /tmp prints it, and completes /tmp/ in that folder", async context => {
      context.skip(!shellIds.includes("git-bash"), "Git Bash is not installed.");
      const sessionId: string = await fixture.openAsync("git-bash", workFolder);
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
      await fixture.waitForQuietAsync(sessionId);
      const sent: readonly string[] = fixture.marks(sessionId)
        .map(t => t.value ?? "")
        .filter(t => t.startsWith(Resources.temporaryFolderProperty))
        .map(t => t.slice(Resources.temporaryFolderProperty.length).replace(Resources.markScannerEscapedCharacter,
          (_, code: string) => String.fromCharCode(Number.parseInt(code, Resources.hexadecimalRadix))));
      await fixture.typeAsync(sessionId, "printf '<tmp=%s>\\n' \"$(cygpath -w /tmp)\"\r");
      await fixture.waitForAsync(sessionId, t => PRINTED_TEMP.test(t), "Git Bash did not print cygpath -w /tmp.");
      const printed: string = PRINTED_TEMP.exec(fixture.text(sessionId))?.[1] ?? "";
      const probe: string = `noldova-temp-${randomUUID().slice(0, 8)}`;
      await writeFile(join(printed, probe), "", "utf8");
      try {
        const line: string = `printf '[%s]\\n' /tmp/${probe.slice(0, -2)}`;
        const completion: TerminalCompletion = TerminalCompletion.fromJson(await fixture.callAsync("terminal.complete", { sessionId, line, cursor: line.length }));

        assert.deepEqual(sent, [printed]);
        assert.deepEqual(completion.items.map(t => t.label), [probe]);
        await fixture.callAsync("terminal.close", { sessionId });
      }
      finally {
        await rm(join(printed, probe), { force: true });
      }
    });
  }

  if (covered.includes("zsh")) {
    it("[zsh] keeps a zsh command without its right prompt, and tells where the right prompt starts after the prompt redraws in place",
      async context => {
        context.skip(!shellIds.includes("zsh"), "zsh is not installed.");
        const sessionId: string = await fixture.openAsync("zsh", workFolder);
        const prompted: () => boolean = () => /C[^B]*B[^C]*$/u.test(fixture.kinds(sessionId));
        const right: string = "[right-317]";
        await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
        await fixture.waitForQuietAsync(sessionId);
        await fixture.typeAsync(sessionId, "RPROMPT=\"[right-$((300 + 17))]\"; bindkey '^G' reset-prompt\r");
        await fixture.waitForAsync(sessionId, t => prompted() && fixture.kinds(sessionId).endsWith("BR") && t.slice(t.lastIndexOf("\u0007")).includes(right),
          "No prompt with the right prompt after setting it.");
        await fixture.waitForQuietAsync(sessionId);

        await fixture.typeAsync(sessionId, "echo nol");
        await fixture.waitForAsync(sessionId, t => t.slice(t.lastIndexOf("\u0007")).replace(STYLES, "").includes("echo nol"), "The typed text was not echoed.");
        await fixture.waitForQuietAsync(sessionId);
        const marked: number = fixture.kinds(sessionId).length;
        await fixture.typeAsync(sessionId, "\u0007");
        await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).slice(marked).includes("R"), "The prompt was not redrawn with its right prompt.");
        await fixture.waitForQuietAsync(sessionId);
        const typing: TerminalAttachment = TerminalAttachment.fromJson(await fixture.callAsync("terminal.attach", { sessionId, paneId: "p1" }));
        await fixture.typeAsync(sessionId, "dova-right\r");

        const column: number = typing.input?.column ?? 0;
        assert.ok((typing.input?.rightPrompt ?? 0) > column + "echo nol".length, `The line starts at ${JSON.stringify(typing.input?.toJson() ?? null)}.`);
        await vi.waitFor(() => assert.ok(fixture.commandsAdded(sessionId).includes("echo noldova-right"),
          `The commands kept were ${JSON.stringify(fixture.commandsAdded(sessionId))}.`), { timeout: WAIT_MS, interval: TEXT_POLL_MS });
        assert.deepEqual(fixture.commandsAdded(sessionId).filter(t => t.includes(right)), []);
        await fixture.callAsync("terminal.close", { sessionId });
      });
  }

  for (const shellId of plainShells)
    it(`[${shellId}] starts ${shellId} without integration`, async context => {
      context.skip(!shellIds.includes(shellId), `${shellId} is not installed.`);
      const sessionId: string = await fixture.openAsync(shellId, workFolder);

      await fixture.typeAsync(sessionId, "echo plain-shell\r");

      await fixture.waitForAsync(sessionId, t => t.split("plain-shell").length > 2, "The shell did not echo.");
      assert.equal(fixture.text(sessionId).includes("\u001b]6973;"), false);
      assert.deepEqual(fixture.cwds(sessionId), []);
      await fixture.callAsync("terminal.close", { sessionId });
    });
}

function defineNonceFileTests(): void {
  it("is readable by the person's account alone, in a folder only it reads, whatever its parent passes on", async () => {
    const parent: string = await mkdtemp(join(tmpdir(), "noldova-terminal-parent-"));
    const context: FakeRuntimePartContext = new FakeRuntimePartContext();
    const integration: ShellIntegration = new ShellIntegration(new FileSystemWriter(), parent, new FakeModuleLog(),
      FolderAccess.create(process.platform, new CommandRunner(context), process.env), new FakeModuleSettings(), process.platform);
    try {
      PrivateFolder.passOnRead(parent);
      const launch: ShellLaunch = await integration.prepareAsync(new Shell("bash", "Bash", TerminalShellKind.Bash, "/bin/bash", [], false), TEST_NONCE, {});
      const nonceFile: string = launch.nonceFile ?? "";

      assert.equal(await readFile(nonceFile, "utf8"), `${TEST_NONCE}\n`);
      for (const path of [dirname(nonceFile), nonceFile])
        PrivateFolder.assertPrivate(path);
    }
    finally {
      await integration.disposeAsync();
      await context.endProgramsAsync();
      await rm(parent, { recursive: true, force: true });
    }
  });
}

function defineStoreInstallTests(): void {
  const storePowerShell: string = join(process.env["LOCALAPPDATA"] ?? "", "Microsoft", "WindowsApps", "pwsh.exe");

  it("is the default shell when no other PowerShell 7 is installed, and starts as PowerShell 7 with its integration", async context => {
    context.skip(process.platform !== "win32", "The Microsoft Store and its app execution aliases exist only on Windows.");
    context.skip(!await new FileSystemReader().isProgramAsync(storePowerShell), "This Windows has no Store install of PowerShell 7.");
    const fixture: RuntimeFixture = new RuntimeFixture();
    const folder: string = await mkdtemp(join(tmpdir(), "noldova-terminal-store-"));
    const workFolder: string = join(folder, WORK_FOLDER);
    await mkdir(workFolder);
    vi.stubEnv("ProgramFiles", folder);
    vi.stubEnv("PATH", join(process.env["SystemRoot"] ?? "", "System32"));
    try {
      await fixture.part.activateAsync(fixture.context);
      const shells: TerminalShells = TerminalShells.fromJson(await fixture.callAsync("terminal.shells", null));
      assert.equal(shells.shells.find(t => t.isDefault)?.id, "pwsh");
      const sessionId: string = await fixture.openAsync("pwsh", workFolder);
      await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
      await fixture.waitForQuietAsync(sessionId);

      await fixture.typeAsync(sessionId, "\"[version-$($PSVersionTable.PSVersion.Major)] [home-$PSHOME]\"; gi nx\r");

      await fixture.waitForAsync(sessionId, () => /C.*D/u.test(fixture.kinds(sessionId)), "No command end mark arrived.", 2 * WAIT_MS);
      assertMarks(fixture.marks(sessionId), "1");
      await fixture.waitForAsync(sessionId, t => /\[version-7\] \[home-[^\]]*WindowsApps/u.test(t), "PowerShell 7 from the Store did not answer.");
      await fixture.callAsync("terminal.close", { sessionId });
    }
    finally {
      await fixture.part.deactivateAsync();
      vi.unstubAllEnvs();
      await rm(folder, { force: true, recursive: true });
    }
  });
}

function defineRestrictedPolicyTests(shellIds: readonly string[]): void {
  for (const shellId of shellIds)
    it(`refuses ${shellId}'s profile and still marks its prompts`, async context => {
      context.skip(process.platform !== "win32", "Execution policies apply only to PowerShell on Windows.");
      const fixture: RuntimeFixture = new RuntimeFixture();
      const folder: string = await mkdtemp(join(tmpdir(), "noldova-terminal-policy-"));
      const workFolder: string = join(folder, WORK_FOLDER);
      await mkdir(workFolder);
      vi.stubEnv("PSExecutionPolicyPreference", "Restricted");
      vi.stubEnv(PROFILE_RUN_VARIABLE, PROFILE_RUN);
      try {
        await fixture.part.activateAsync(fixture.context);
        context.skip(!(await fixture.shellIdsAsync()).includes(shellId), `${shellId} is not installed.`);
        await withProfilesAsync(context, shellId, [POLICY_PROFILE], async () => {
          const sessionId: string = await fixture.openAsync(shellId, workFolder);
          await fixture.waitForAsync(sessionId, () => fixture.kinds(sessionId).includes("B"), "No prompt mark arrived.", SHELL_COLD_START_MS);
          await fixture.waitForQuietAsync(sessionId);

          await fixture.typeAsync(sessionId, "\"[runs-$($NoldovaProfileRuns -join ',')]\"; gi nx\r");

          await fixture.waitForAsync(sessionId, () => /^LP{0,6}AB.*PD/u.test(fixture.kinds(sessionId)), "No command end mark arrived.", 2 * WAIT_MS);
          assert.equal(fixture.marks(sessionId).find(t => t.kind === "D")?.value, "1");
          await fixture.waitForAsync(sessionId, t => t.includes("[runs-]"), "The profile ran under the Restricted policy.");
          await fixture.callAsync("terminal.close", { sessionId });
        });
      }
      finally {
        await fixture.part.deactivateAsync();
        vi.unstubAllEnvs();
        await rm(folder, { force: true, recursive: true });
      }
    });
}

function defineReadProfileTests(): void {
  it("is removed once the other PowerShell lets it go", async context => {
    context.skip(process.platform !== "win32", "Only Windows keeps a file that another program has open from being removed or written.");
    const held: string[] = [];
    await withProfilesAsync(context, "powershell", [POLICY_PROFILE], async profiles => {
      held.push(...profiles);
      await holdAsync(profiles[0] ?? "");
    });

    assert.equal(held.length, 1);
    assert.equal(await stat(held[0] ?? "").then(() => true, () => false), false);
  });

  it("replaces an ended run's profile once the other PowerShell lets it go", async context => {
    context.skip(process.platform !== "win32", "Only Windows keeps a file that another program has open from being removed or written.");
    const profile: string = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "$PROFILE.CurrentUserAllHosts"],
      { encoding: "utf8", timeout: WAIT_MS }).stdout.trim();
    const ended: SpawnSyncReturns<string> = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "exit"], { encoding: "utf8", timeout: WAIT_MS });
    await mkdir(dirname(profile), { recursive: true });
    const isNew: boolean = await writeFile(profile, `if ($env:${PROFILE_RUN_VARIABLE} -ne '${ended.pid}-${randomUUID()}') { return }\n${POLICY_PROFILE}`,
      { encoding: "utf8", flag: "wx" }).then(() => true, () => false);
    assert.ok(isNew || process.env["CI"] === undefined, `powershell already has ${profile}; move it aside.`);
    context.skip(!isNew, `powershell already has ${profile}.`);
    await holdAsync(profile);
    let replaced: string = "";

    await withProfilesAsync(context, "powershell", [POLICY_PROFILE], async profiles => {
      replaced = await readFile(profiles[0] ?? "", "utf8");
    });

    assert.equal(PROFILE_GUARD.exec(replaced)?.[1], String(process.pid));
  });
}

function assertMarks(marks: readonly ShellMarkView[], exitCode: string): void {
  const nonces: ReadonlySet<string> = new Set(marks.map(t => t.nonce));
  const kinds: string = marks.map(t => t.kind).join("");
  const end: number = kinds.indexOf("D");
  const cwd: string | null | undefined = marks.slice(0, end).findLast(t => t.kind === "P")?.value;

  assert.equal(nonces.size, 1, "The marks carry more than one nonce.");
  assert.match(kinds, /^LP{0,6}AB.*C.*PD/u);
  assert.equal(marks[end]?.value, exitCode);
  assert.ok(cwd?.startsWith("Cwd=") === true && cwd.endsWith(WORK_FOLDER), `The working folder mark was ${String(cwd)}.`);
}

async function nonceFilesAsync(nonce: string): Promise<readonly string[]> {
  const found: string[] = [];
  for (const folder of (await readdir(tmpdir(), { withFileTypes: true })).filter(t => t.isDirectory() && t.name.startsWith("noldova-terminal-"))) {
    const names: readonly string[] = await readdir(join(tmpdir(), folder.name)).catch((): string[] => []);
    for (const name of names.filter(t => t.startsWith("nonce-")))
      if ((await readFile(join(tmpdir(), folder.name, name), "utf8").catch(() => "")).trim() === nonce)
        found.push(join(folder.name, name));
  }
  return found;
}

function profileTime(step: string): string {
  return `if ($env:${PROFILE_TIMES_VARIABLE}) { Add-Content -LiteralPath $env:${PROFILE_TIMES_VARIABLE} -Value "${step} $([DateTime]::UtcNow.ToString('o'))" -ErrorAction SilentlyContinue }\n`;
}

function executableOf(shellId: string): string {
  return SHELL_FILES.get(shellId) ?? shellId;
}

async function warmModuleCacheAsync(shellId: string): Promise<void> {
  const warming: ChildProcess = spawn(executableOf(shellId), ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
    `Get-Command -Name '[n]oldovawarm' -ErrorAction SilentlyContinue | Out-Null; Start-Sleep -Milliseconds ${Resources.powerShellLookupCacheMilliseconds}`],
  { stdio: "ignore", windowsHide: true });
  const [code]: unknown[] = await once(warming, "exit");
  assert.equal(code, 0, `Warming ${shellId}'s module analysis cache failed.`);
}

function describeProgramLookups(lookups: readonly ProcessRequest[]): string {
  if (lookups.length === 0)
    return "whoami was missing, and no lookup ran.";
  const systemFolder: string = join(process.env["SystemRoot"] ?? "", "System32").toLowerCase();
  return lookups.map((lookup, index) => {
    const path: string = lookup.environment["PATH"] ?? "";
    const extensions: string = lookup.environment["PATHEXT"] ?? "";
    const folders: readonly string[] = path.split(";").filter(t => t !== "");
    const hasSystemFolder: boolean = folders.some(t => t.replace(/[\\/]+$/u, "").toLowerCase() === systemFolder);
    const hasExe: boolean = extensions.split(";").some(t => t.toUpperCase() === ".EXE");
    const replaced: ReadonlySet<string> = new Set(Object.keys(lookup.environment).map(t => t.toUpperCase()));
    const again: SpawnSyncReturns<string> = spawnSync(lookup.program, ["-NoProfile", "-NonInteractive", "-Command",
      "@(Get-Command -Name 'whoami*' -CommandType Application).Name -join ','"], { encoding: "utf8", timeout: WAIT_MS,
      env: { ...Object.fromEntries(Object.entries(process.env).filter(([t]) => !replaced.has(t.toUpperCase()))), ...lookup.environment } });
    const cause: string = !hasSystemFolder ? `its PATH, of ${folders.length} folders${folders.some(t => t.includes("%")) ? " with an unexpanded %" : ""}, had no ${systemFolder}`
      : !hasExe ? `its PATHEXT, ${JSON.stringify(extensions)}, had no .EXE`
        : "its PATH and PATHEXT held them, so its program search ended early";
    return `Lookup ${index + 1} of ${lookups.length}: ${cause}. The same search run again with its PATH and PATHEXT found `
      + `${JSON.stringify((again.stdout ?? "").trim())}, status ${again.status}, errors ${JSON.stringify((again.stderr ?? "").trim().slice(0, OUTPUT_TAIL))}`
      + `${again.error === undefined ? "" : `, and it could not run: ${again.error.message}`}.`;
  }).join(" ");
}

async function withProfilesAsync(context: TestContext, shellId: string, texts: readonly string[], check: (profiles: readonly string[]) => Promise<void>): Promise<void> {
  const result: SpawnSyncReturns<string> = spawnSync(executableOf(shellId), ["-NoProfile", "-NonInteractive", "-Command",
    "$PROFILE.CurrentUserAllHosts; $PROFILE.CurrentUserCurrentHost"], { encoding: "utf8", timeout: WAIT_MS });
  assert.equal(result.status, 0, `Reading ${shellId}'s profiles failed: ${result.stderr}`);
  const profiles: readonly string[] = result.stdout.split(/\r?\n/u).filter(t => t !== "");
  const written: (readonly [string, string])[] = [];
  try {
    for (const [index, text] of texts.entries()) {
      const profile: string = profiles[index] ?? "";
      const content: string = `if ($env:${PROFILE_RUN_VARIABLE} -ne '${PROFILE_RUN}') { return }\n${text}`;
      await mkdir(dirname(profile), { recursive: true });
      const isNew: boolean = await writeFile(profile, content, { encoding: "utf8", flag: "wx" }).then(() => true, (error: unknown) => {
        if (!(error instanceof Error && "code" in error && error.code === "EEXIST"))
          throw error;
        return false;
      });
      if (!isNew) {
        const isEnded: boolean = isEndedRunProfile(await readFile(profile, "utf8").catch(() => ""));
        assert.ok(isEnded || process.env["CI"] === undefined, `${shellId} already has ${profile}; move it aside.`);
        context.skip(!isEnded, `${shellId} already has ${profile}.`);
        await vi.waitFor(() => writeFile(profile, content, "utf8"), { timeout: WAIT_MS, interval: TEXT_POLL_MS });
      }
      written.push([profile, content]);
    }
    await check(written.map(t => t[0]));
  }
  finally {
    for (const [profile, content] of written)
      if (await readFile(profile, "utf8").catch(() => "") === content)
        await vi.waitFor(() => rm(profile, { force: true }), { timeout: WAIT_MS, interval: TEXT_POLL_MS });
  }
}

async function holdAsync(file: string): Promise<void> {
  const reader: ChildProcess = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
    "$file = [System.IO.File]::Open($env:NOLDOVA_TEST_HELD, 'Open', 'Read', 'Read'); '[held]'; Start-Sleep -Milliseconds 1500; $file.Close()"],
    { env: { ...process.env, NOLDOVA_TEST_HELD: file }, stdio: ["ignore", "pipe", "ignore"] });
  const held: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  let output: string = "";
  reader.stdout?.on("data", (data: Buffer) => {
    output += data.toString();
    if (output.includes("[held]"))
      held.resolve();
  });
  reader.once("exit", () => held.reject(new Error(`The other PowerShell ended before it opened the profile: ${output}`)));
  await held.promise;
}

function isEndedRunProfile(content: string): boolean {
  const guard: RegExpExecArray | null = PROFILE_GUARD.exec(content);
  if (guard === null || ![...PROFILES, POLICY_PROFILE, BOUND_PROFILE].includes(content.slice(guard[0].length)))
    return false;
  try {
    process.kill(Number(guard[1]), 0);
    return false;
  }
  catch (error) {
    return error instanceof Error && "code" in error && error.code === "ESRCH";
  }
}

async function integrationFoldersAsync(): Promise<readonly string[]> {
  const names: string[] = [];
  for (const folder of (await readdir(tmpdir(), { withFileTypes: true })).filter(t => t.isDirectory() && t.name.startsWith("noldova-terminal-")))
    if (await stat(join(tmpdir(), folder.name, "noldova.bash")).then(() => true, () => false))
      names.push(folder.name);
  return names;
}

async function hasPs0Async(file: string): Promise<boolean> {
  const [major = 0, minor = 0]: number[] = (await readFile(file, "utf8")).split(".").map(Number);
  return major > 4 || (major === 4 && minor >= 4);
}
