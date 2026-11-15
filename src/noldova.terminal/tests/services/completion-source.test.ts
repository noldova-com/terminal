/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ProcessExit } from "@noldova/desktop.runtime";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { TerminalCompletion, TerminalCompletionItem, TerminalCompletionKind, TerminalShellKind, type TerminalMissingCommands } from "@noldova/terminal.protocol";
import { describe, it, type MockInstance, vi } from "vitest";

import { CommandExitedException } from "../../src/exceptions/command-exited.exception.ts";
import { CommandTimedOutException } from "../../src/exceptions/command-timed-out.exception.ts";
import { Resources } from "../../src/resources.ts";
import { CommandTracker } from "../../src/services/command-tracker.ts";
import { CompletionSource } from "../../src/services/completion-source.ts";
import { FakeCommandRunner } from "../fixtures/fake-command-runner.fixture.ts";
import { FakeFileSystemReader } from "../fixtures/fake-file-system-reader.fixture.ts";

type Choice = [string, string, string];

const PWSH: string = "/usr/bin/pwsh";

class SourceFixture {
  public readonly fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
  public readonly runner: FakeCommandRunner = new FakeCommandRunner();
  public readonly log: FakeModuleLog = new FakeModuleLog();
  public readonly source: CompletionSource;
  private readonly shells: Map<string, CommandTracker> = new Map<string, CommandTracker>();

  public constructor(platform: string = "linux", homeFolder: string = "/home/a") {
    this.source = new CompletionSource(this.fileSystem, this.runner, platform, homeFolder, this.log);
  }

  public async completeAsync(line: string, folder: string = "/work", environment: Readonly<Record<string, string>> = {},
    kind: TerminalShellKind = TerminalShellKind.Bash, key: string = "s1", shellNames: ReadonlySet<string> | null = null,
    shellBuiltins: ReadonlySet<string> | null = null): Promise<[number, readonly Choice[]]> {
    const completion: TerminalCompletion = await this.source.completeAsync(key, kind, line, line.length, folder, environment, shellNames, shellBuiltins);
    return [completion.replaceFrom, completion.items.map(t => [t.text, t.label, t.kind])];
  }

  public async missingAsync(names: readonly string[], shellNames: readonly string[] | null = [], environment: Readonly<Record<string, string>> = {},
    kind: TerminalShellKind = TerminalShellKind.Bash, key: string = "s1", prompt: number = 1, shell: CommandTracker = this.shellOf(key),
    folder: string = "/work"): Promise<readonly string[]> {
    const missing: TerminalMissingCommands = await this.source.findMissingAsync(key, shell, prompt, kind, folder, names,
      shellNames === null ? null : new Set(shellNames), environment);
    return missing.names;
  }

  public async powerShellMissingAsync(names: readonly string[], shellNames: ReadonlySet<string> | null,
    environment: Readonly<Record<string, string>> = {}, shell: CommandTracker = this.shellOf("s1")): Promise<readonly string[]> {
    return (await this.source.findMissingPowerShellAsync(shell, PWSH, names, shellNames, environment)).names;
  }

  public get lookups(): readonly string[] {
    return this.runner.runs.filter(t => t[0] === PWSH).map(t => Buffer.from(t[1].at(-1) ?? "", "base64").toString("utf16le"));
  }

  public shellOf(key: string): CommandTracker {
    const shell: CommandTracker = this.shells.get(key) ?? new CommandTracker(() => "");
    this.shells.set(key, shell);
    return shell;
  }

  public async choicesAsync(line: string, folder?: string, environment?: Readonly<Record<string, string>>,
    kind?: TerminalShellKind): Promise<readonly Choice[]> {
    return (await this.completeAsync(line, folder, environment, kind))[1];
  }
}

describe("CompletionSource", () => {
  it("gives a shell it doesn't read no choices, at the cursor", async () => {
    const fixture: SourceFixture = new SourceFixture();
    fixture.fileSystem.files.set("/work/setup.sh", "");

    for (const kind of [TerminalShellKind.Fish, TerminalShellKind.CommandPrompt, TerminalShellKind.Wsl, TerminalShellKind.Other])
      assert.deepEqual(await fixture.completeAsync("cat s", "/work", {}, kind), [5, []]);
  });

  describe("for a command's first word", () => {
    it("lists the names the shell reported and each file of the PATH's absolute folders once, sorted, but not their folders", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.fileSystem.files.set("/usr/bin/git", "");
      fixture.fileSystem.files.set("/usr/bin/grep", "");
      fixture.fileSystem.files.set("/opt/bin/git", "");
      fixture.fileSystem.folders.add("/usr/bin/gnome");
      fixture.fileSystem.files.set("/usr/bin/ls", "");
      const environment: Record<string, string> = { PATH: "/usr/bin:/opt/bin:bin:/usr/bin" };

      assert.deepEqual(await fixture.completeAsync("g", "/work", environment, TerminalShellKind.Bash, "s1", new Set(["getopts", "git"])), [0, [
        ["getopts", "getopts", "Command"],
        ["git", "git", "Command"],
        ["grep", "grep", "Command"]
      ]]);
      assert.deepEqual(await fixture.choicesAsync("cat a | G", "/work", environment), []);
    });

    it("lists only the shell's names without a PATH, each shell its own, but not its helpers, autocd or suffix aliases, and none before it reported them", async () => {
      const fixture: SourceFixture = new SourceFixture();
      const names: ReadonlySet<string> = new Set(["pwd", "_pwd_helper", "__noldova_mark", "*/", "*.txt", "setopt"]);

      assert.deepEqual((await fixture.completeAsync("", "/work", {}, TerminalShellKind.Bash, "s1", names))[1], [["pwd", "pwd", "Command"], ["setopt", "setopt", "Command"]]);
      assert.deepEqual((await fixture.completeAsync("setop", "/work", {}, TerminalShellKind.Zsh, "s1", new Set(["setopt"])))[1], [["setopt", "setopt", "Command"]]);
      assert.deepEqual(await fixture.choicesAsync("pw"), []);
      assert.deepEqual(await fixture.choicesAsync("set-l", "/work", {}, TerminalShellKind.PowerShell), [["Set-Location", "Set-Location", "Command"]]);
    });

    it("lists the builtins a shell reported apart, once each, with no names, as an older Git Bash sends, and after a names reset", async () => {
      const fixture: SourceFixture = new SourceFixture();
      const builtins: ReadonlySet<string> = new Set(["cd", "case", "export"]);

      assert.deepEqual([
        (await fixture.completeAsync("c", "/work", {}, TerminalShellKind.Bash, "s1", null, builtins))[1],
        (await fixture.completeAsync("c", "/work", {}, TerminalShellKind.Bash, "s1", new Set(["cd", "cdl"]), builtins))[1]
      ], [
        [["case", "case", "Command"], ["cd", "cd", "Command"]],
        [["case", "case", "Command"], ["cd", "cd", "Command"], ["cdl", "cdl", "Command"]]
      ]);
    });

    it("lists paths for a word that starts with a dot or the home folder, or holds a slash", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.fileSystem.files.set("/work/run.sh", "");
      fixture.fileSystem.files.set("/work/bin/tool", "");

      assert.deepEqual(await fixture.choicesAsync("./r"), [["./run.sh", "run.sh", "File"]]);
      assert.deepEqual(await fixture.choicesAsync("bin/"), [["bin/tool", "tool", "File"]]);
      assert.deepEqual(await fixture.choicesAsync("~"), []);
    });
  });

  describe("for a path", () => {
    it("lists the files and folders of the working folder, escaped for the line, without hidden names", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.fileSystem.files.set("/work/a b.txt", "");
      fixture.fileSystem.files.set("/work/.env", "");
      fixture.fileSystem.folders.add("/work/src");
      fixture.fileSystem.folders.add("/work/.git");

      assert.deepEqual(await fixture.completeAsync("cat "), [4, [["a\\ b.txt", "a b.txt", "File"], ["src/", "src/", "Folder"]]]);
      assert.deepEqual(await fixture.choicesAsync("cat ."), [[".env", ".env", "File"], [".git/", ".git/", "Folder"]]);
      assert.deepEqual(await fixture.choicesAsync("cat S"), []);
    });

    it("lists a typed folder's names, from the working folder, the root or the home folder, in the quote they were typed in", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.fileSystem.folders.add("/work/src");
      fixture.fileSystem.files.set("/work/src/main.ts", "");
      fixture.fileSystem.files.set("/home/a/notes", "");

      assert.deepEqual(await fixture.completeAsync("cat src/m"), [4, [["src/main.ts", "main.ts", "File"]]]);
      assert.deepEqual(await fixture.choicesAsync("cat ~/"), [["~/notes", "notes", "File"]]);
      assert.deepEqual(await fixture.completeAsync("cd '/work/s"), [3, [["'/work/src/", "src/", "Folder"]]]);
      assert.deepEqual(await fixture.choicesAsync("cat \"src/"), [["\"src/main.ts\"", "main.ts", "File"]]);
    });

    it("reads ~ as the home folder only where bash reads it so, unquoted, and escapes a name's own leading ~", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.fileSystem.files.set("/home/a/notes", "");
      fixture.fileSystem.folders.add("/work/~");
      fixture.fileSystem.files.set("/work/~/nested", "");
      fixture.fileSystem.files.set("/work/~root", "");

      assert.deepEqual(await fixture.choicesAsync("cat ~/n"), [["~/notes", "notes", "File"]]);
      assert.deepEqual(await fixture.choicesAsync("cat '~/n"), [["'~/nested'", "nested", "File"]]);
      assert.deepEqual(await fixture.choicesAsync("cat \"~/n"), [["\"~/nested\"", "nested", "File"]]);
      assert.deepEqual(await fixture.choicesAsync("cat \\~/n"), [["\\~/nested", "nested", "File"]]);
      assert.deepEqual(await fixture.choicesAsync("cat ~r"), [["\\~root", "~root", "File"]]);
      assert.deepEqual(await fixture.choicesAsync("cat '~/n", "/work", {}, TerminalShellKind.PowerShell), [["'~/notes'", "notes", "File"]]);
    });

    it("escapes a PowerShell path's wildcards and quotes it where a cmdlet's -Path reads them, but not for a native program, another parameter or a command", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.fileSystem.files.set("/work/e[1]", "");
      fixture.fileSystem.files.set("/work/t`x", "");
      fixture.fileSystem.files.set("/usr/bin/e[2]", "");

      for (const line of ["Get-Item e", "Get-Item -Path e", "gi -path e", "gci -Recurse -Force e", "gci -Verbose e", "gci -Verbose:$true e",
        "gci -Filter x e", "Copy-Item -Destination d e", "Copy-Item e", "Remove-Item -Force -r e", "gi -Pa e"])
        assert.deepEqual(await fixture.choicesAsync(line, "/work", {}, TerminalShellKind.PowerShell), [["'e`[1`]'", "e[1]", "File"]], line);
      assert.deepEqual(await fixture.choicesAsync("gc \"t", "/work", {}, TerminalShellKind.PowerShell), [["\"t````x\"", "t`x", "File"]]);
      for (const line of ["cat e", "ls e", "rm e", "Get-Item -LiteralPath e", "gi -LP e", "gi -PSPath e", "Copy-Item a e", "Copy-Item -Path a -Destination e",
        "gi -Path a e", "gi -LiteralPath:a e", "Copy-Item -r a e", "gci -f e", "node e"])
        assert.deepEqual(await fixture.choicesAsync(line, "/work", {}, TerminalShellKind.PowerShell), [["e[1]", "e[1]", "File"]], line);
      assert.deepEqual(await fixture.choicesAsync("node t", "/work", {}, TerminalShellKind.PowerShell), [["'t`x'", "t`x", "File"]]);
      assert.deepEqual(await fixture.choicesAsync("e[", "/work", { PATH: "/usr/bin" }, TerminalShellKind.PowerShell), [["e[2]", "e[2]", "Command"]]);
    });

    it("escapes for PowerShell's Windows-only aliases of those cmdlets on Windows", async () => {
      const fixture: SourceFixture = new SourceFixture("win32", "C:\\Users\\a");
      fixture.fileSystem.files.set("C:\\work\\e[1]", "");

      for (const line of ["cat e", "ls e", "rm e", "rm -r e", "ac e", "cp e", "mv e", "rmdir e", "Get-Item e"])
        assert.deepEqual(await fixture.choicesAsync(line, "C:\\work", {}, TerminalShellKind.PowerShell), [["'e`[1`]'", "e[1]", "File"]], line);
      assert.deepEqual(await fixture.choicesAsync("gi -LiteralPath e", "C:\\work", {}, TerminalShellKind.PowerShell), [["e[1]", "e[1]", "File"]]);
    });

    it("reads a PowerShell path word's wildcard escapes back only where a cmdlet's -Path reads them, so a second Tab lists inside the folder", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.fileSystem.files.set("/work/e[1]/in.txt", "");
      fixture.fileSystem.files.set("/work/e`[1`]/out.txt", "");

      assert.deepEqual(await fixture.choicesAsync("gc 'e`[1`]/", "/work", {}, TerminalShellKind.PowerShell), [["'e`[1`]/in.txt'", "in.txt", "File"]]);
      for (const line of ["gc -LiteralPath 'e`[1`]/", "cat 'e`[1`]/", "node 'e`[1`]/"])
        assert.deepEqual(await fixture.choicesAsync(line, "/work", {}, TerminalShellKind.PowerShell), [["'e`[1`]/out.txt'", "out.txt", "File"]], line);
    });

    it("lists what answered once a folder doesn't answer by the list's deadline, and lists nothing more for that terminal until its read ends", async () => {
      vi.useFakeTimers();
      try {
        const fixture: SourceFixture = new SourceFixture();
        const stalled: PromiseWithResolvers<void> = Promise.withResolvers<void>();
        fixture.fileSystem.stalled.set("/share/bin", stalled.promise);
        fixture.fileSystem.files.set("/usr/bin/git", "");
        fixture.fileSystem.files.set("/share/bin/gzip", "");
        fixture.fileSystem.files.set("/work/run.sh", "");
        const environment: Readonly<Record<string, string>> = { PATH: "/share/bin:/usr/bin" };

        const first: Promise<[number, readonly Choice[]]> = fixture.completeAsync("gi", "/work", environment);
        let isListed: boolean = false;
        void first.then(() => isListed = true, () => isListed = true);
        await vi.advanceTimersByTimeAsync(999);
        const isListedEarly: boolean = isListed;
        await vi.advanceTimersByTimeAsync(1);
        assert.deepEqual([isListedEarly, await first], [false, [0, [["git", "git", "Command"]]]]);
        assert.deepEqual(await fixture.completeAsync("cat r"), [5, []]);
        assert.deepEqual(await fixture.completeAsync("cat r", "/work", {}, TerminalShellKind.Bash, "s2"), [4, [["run.sh", "run.sh", "File"]]]);
        assert.deepEqual(fixture.fileSystem.listed, ["/share/bin", "/usr/bin", "/work"]);
        stalled.resolve();
        await vi.advanceTimersByTimeAsync(0);
        assert.deepEqual(await fixture.completeAsync("cat r"), [4, [["run.sh", "run.sh", "File"]]]);
      }
      finally {
        vi.useRealTimers();
      }
    });

    it("joins a read of a folder still under way, so quick Tabs on a folder that never answers start one read, and refuses the terminal until it ends", async () => {
      vi.useFakeTimers();
      try {
        const fixture: SourceFixture = new SourceFixture();
        const stalled: PromiseWithResolvers<void> = Promise.withResolvers<void>();
        fixture.fileSystem.stalled.set("/share/bin", stalled.promise);
        fixture.fileSystem.files.set("/usr/bin/git", "");
        const environment: Readonly<Record<string, string>> = { PATH: "/share/bin:/usr/bin" };

        const tabs: Promise<[number, readonly Choice[]]>[] = [1, 2, 3].map(() => fixture.completeAsync("gi", "/work", environment));
        await vi.advanceTimersByTimeAsync(1_000);
        assert.deepEqual(await Promise.all(tabs), [1, 2, 3].map(() => [0, [["git", "git", "Command"]]]));
        assert.deepEqual(fixture.fileSystem.listed, ["/share/bin", "/usr/bin"]);
        assert.deepEqual(await fixture.completeAsync("gi", "/work", environment), [2, []]);
        stalled.resolve();
        await vi.advanceTimersByTimeAsync(0);
        assert.deepEqual(await fixture.completeAsync("gi", "/work", environment), [0, [["git", "git", "Command"]]]);
      }
      finally {
        vi.useRealTimers();
      }
    });

    it("keeps refusing a terminal while another of its lists still has a read past its deadline, after one list's read ends", async () => {
      vi.useFakeTimers();
      try {
        const fixture: SourceFixture = new SourceFixture();
        const first: PromiseWithResolvers<void> = Promise.withResolvers<void>();
        const second: PromiseWithResolvers<void> = Promise.withResolvers<void>();
        fixture.fileSystem.stalled.set("/work/a", first.promise);
        fixture.fileSystem.stalled.set("/work/b", second.promise);
        fixture.fileSystem.files.set("/work/run.sh", "");

        const lists: Promise<[number, readonly Choice[]]>[] = [fixture.completeAsync("cat a/"), fixture.completeAsync("cat b/")];
        await vi.advanceTimersByTimeAsync(1_000);
        assert.deepEqual(await Promise.all(lists), [[4, []], [4, []]]);
        first.resolve();
        await vi.advanceTimersByTimeAsync(0);
        assert.deepEqual(await fixture.completeAsync("cat r"), [5, []]);
        second.resolve();
        await vi.advanceTimersByTimeAsync(0);
        assert.deepEqual(await fixture.completeAsync("cat r"), [4, [["run.sh", "run.sh", "File"]]]);
      }
      finally {
        vi.useRealTimers();
      }
    });

    it("starts no read after the list's deadline, so a walk up to a file that never answers reads it once", async () => {
      vi.useFakeTimers();
      try {
        const fixture: SourceFixture = new SourceFixture();
        fixture.fileSystem.stalled.set("/a/b/c/package.json", new Promise<void>(() => undefined));
        fixture.fileSystem.files.set("/package.json", "{\"scripts\":{\"build\":\"\"}}");

        const completion: Promise<[number, readonly Choice[]]> = fixture.completeAsync("npm run b", "/a/b/c");
        await vi.advanceTimersByTimeAsync(1_000);
        assert.deepEqual(await completion, [8, []]);
        assert.deepEqual(fixture.fileSystem.listed, ["/a/b/c/package.json"]);
      }
      finally {
        vi.useRealTimers();
      }
    });

    it("lists for each of a terminal's requests while another of its lists goes on", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.fileSystem.files.set("/work/run.sh", "");
      fixture.fileSystem.files.set("/work/read.me", "");

      const choices: readonly (readonly Choice[])[] = await Promise.all([fixture.choicesAsync("cat ru"), fixture.choicesAsync("cat re")]);
      assert.deepEqual(choices, [[["run.sh", "run.sh", "File"]], [["read.me", "read.me", "File"]]]);
    });

    it("gives at most 500 choices, and none whose text is longer than a path", async () => {
      const fixture: SourceFixture = new SourceFixture();
      for (let index: number = 0; index < 501; index++)
        fixture.fileSystem.files.set(`/many/f${String(index).padStart(3, "0")}`, "");
      fixture.fileSystem.files.set(`/long/${"x".repeat(4_096)}`, "");
      fixture.fileSystem.files.set("/long/y", "");

      const choices: readonly Choice[] = await fixture.choicesAsync("cat ", "/many");
      assert.deepEqual([choices.length, choices[0]?.[0], choices[499]?.[0]], [500, "f000", "f499"]);
      assert.deepEqual(await fixture.choicesAsync("cat /long/"), [["/long/y", "y", "File"]]);
    });
  });

  describe("for the options the shell's own completers give", () => {
    it("knows a word after the command's name, past a pipe or a semicolon, from the command's name itself", () => {
      const source: CompletionSource = new SourceFixture().source;

      assert.deepEqual(["", "gi", "git ", "git -", "ls | gr", "ls | grep -", "a; b -"].map(t => source.followsCommand(TerminalShellKind.Bash, t, t.length)),
        [false, false, true, true, false, true, true]);
      assert.equal(source.followsCommand(TerminalShellKind.PowerShell, "Get-ChildItem -R", 16), true);
    });

    it("adds the options that start with the cursor's word among the choices, sorted, without repeats, PowerShell's ignoring case", () => {
      const source: CompletionSource = new SourceFixture().source;
      const files: TerminalCompletion = new TerminalCompletion(14, [new TerminalCompletionItem("-readme.md", "-readme.md", TerminalCompletionKind.File)]);
      const bash: TerminalCompletion = source.addOptions(new TerminalCompletion(3, []), TerminalShellKind.Bash, "ls --a", 6,
        ["--all", "--All", "--author", "--all", "-x", " "]);
      const powerShell: TerminalCompletion = source.addOptions(files, TerminalShellKind.PowerShell, "Get-ChildItem -R", 16,
        ["-Recurse", "-ReadOnly", "-Path", "-readme.md"]);

      assert.deepEqual([bash.replaceFrom, bash.items.map(t => [t.label, t.kind])], [3, [["--all", "Option"], ["--author", "Option"]]]);
      assert.deepEqual(powerShell.items.map(t => [t.label, t.kind]), [["-readme.md", "File"], ["-ReadOnly", "Option"], ["-Recurse", "Option"]]);
    });

    it("keeps the list at 500 choices with the options in, and the list as it was when no option fits", () => {
      const source: CompletionSource = new SourceFixture().source;
      const files: TerminalCompletion = new TerminalCompletion(3, Array.from({ length: 500 },
        (_, index) => new TerminalCompletionItem(`-f${String(index).padStart(3, "0")}`, `-f${String(index).padStart(3, "0")}`, TerminalCompletionKind.File)));

      const full: TerminalCompletion = source.addOptions(files, TerminalShellKind.Bash, "ls -", 4, ["--all"]);

      assert.deepEqual([full.items.length, full.items[0]?.label, full.items[499]?.label], [500, "--all", "-f498"]);
      assert.equal(source.addOptions(files, TerminalShellKind.Bash, "ls -", 4, ["+x"]), files);
    });
  });

  describe("for typed command names", () => {
    it("gives the names that are no reported name or program on PATH, in the order asked, for bash and zsh, so a builtin is known only once reported", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.fileSystem.files.set("/usr/bin/git", "");
      fixture.fileSystem.folders.add("/usr/bin/tools");
      const environment: Readonly<Record<string, string>> = { PATH: "/usr/bin" };

      assert.deepEqual(await fixture.missingAsync(["gti", "git", "cd", "ll", "tools", "Git"], ["ll", "cd"], environment), ["gti", "tools", "Git"]);
      assert.deepEqual(await fixture.missingAsync(["gti", "setopt"], ["ll"], environment, TerminalShellKind.Zsh), ["gti", "setopt"]);
    });

    it("never gives a path, a name from the home folder, a hidden name or a name starting with _, as the scripts leave such functions out", async () => {
      const fixture: SourceFixture = new SourceFixture();

      assert.deepEqual(await fixture.missingAsync(["./run.sh", "bin/run", "/opt/run", "~/run", "~", ".hidden", "_git", "run"]), ["run"]);
    });

    it("never gives a file name whose last suffix has a zsh suffix alias", async () => {
      const fixture: SourceFixture = new SourceFixture();

      assert.deepEqual(await fixture.missingAsync(["notes.txt", "a.tar.gz", "a.gz.tar", "txt", "notes.md"], ["*.txt", "*.gz"], {}, TerminalShellKind.Zsh),
        ["a.gz.tar", "txt", "notes.md"]);
    });

    it("with autocd, never gives the name of a folder in the shell's working folder, and reads no folder without it", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.fileSystem.folders.add("/work/src");
      fixture.fileSystem.files.set("/work/notes", "");
      fixture.fileSystem.folders.add("/other/docs");

      assert.deepEqual(await fixture.missingAsync(["src", "notes", "docs"], ["*/"], {}, TerminalShellKind.Zsh), ["notes", "docs"]);
      assert.deepEqual(await fixture.missingAsync(["src", "docs"], ["*/"], {}, TerminalShellKind.Bash, "s2", 1, fixture.shellOf("s2"), "/other"), ["src"]);
      fixture.fileSystem.listed.length = 0;
      assert.deepEqual(await fixture.missingAsync(["src"], [], {}, TerminalShellKind.Zsh, "s3"), ["src"]);
      assert.deepEqual(fixture.fileSystem.listed, []);
    });

    it("with autocd, reads Git Bash's working folder as the Windows folder it names, in any case", async () => {
      const fixture: SourceFixture = new SourceFixture("win32", "C:\\Users\\a");
      fixture.fileSystem.folders.add("C:\\Work\\Src");

      assert.deepEqual(await fixture.missingAsync(["src", "lib"], ["*/"], {}, TerminalShellKind.Bash, "s1", 1, fixture.shellOf("s1"), "/c/Work"), ["lib"]);
    });

    it("with autocd, reads Git Bash's /tmp as its TEMP folder, and no folder for a path outside a drive", async () => {
      const fixture: SourceFixture = new SourceFixture("win32", "C:\\Users\\a");
      fixture.fileSystem.folders.add("C:\\Temp\\src");
      const environment: Readonly<Record<string, string>> = { TEMP: "C:\\Temp" };

      assert.deepEqual(await fixture.missingAsync(["src", "lib"], ["*/"], environment, TerminalShellKind.Bash, "s1", 1, fixture.shellOf("s1"), "/tmp"), ["lib"]);
      fixture.fileSystem.listed.length = 0;
      assert.deepEqual(await fixture.missingAsync(["src"], ["*/"], environment, TerminalShellKind.Bash, "s2", 1, fixture.shellOf("s2"), "/usr/src"), ["src"]);
      assert.deepEqual(fixture.fileSystem.listed, []);
    });

    it("with autocd, gives none once the working folder doesn't answer by the deadline", async () => {
      vi.useFakeTimers();
      try {
        const fixture: SourceFixture = new SourceFixture();
        const stalled: PromiseWithResolvers<void> = Promise.withResolvers<void>();
        fixture.fileSystem.stalled.set("/work", stalled.promise);

        const missing: Promise<readonly string[]> = fixture.missingAsync(["gti"], ["*/"], {}, TerminalShellKind.Zsh);
        await vi.advanceTimersByTimeAsync(1_000);
        assert.deepEqual(await missing, []);
        stalled.resolve();
      }
      finally {
        vi.useRealTimers();
      }
    });

    it("lists PATH's programs once for a shell's prompt, each terminal keeping its own, and again at the next prompt, after a restart or for another PATH", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.fileSystem.folders.add("/opt/bin");
      const environment: Readonly<Record<string, string>> = { PATH: "/usr/bin" };
      const bash: TerminalShellKind = TerminalShellKind.Bash;
      assert.deepEqual([await fixture.missingAsync(["gti"], [], environment), await fixture.missingAsync(["gti"], [], environment, bash, "s2")], [["gti"], ["gti"]]);

      fixture.fileSystem.files.set("/usr/bin/gti", "");
      fixture.fileSystem.files.set("/opt/bin/gti", "");

      assert.deepEqual([await fixture.missingAsync(["gti"], [], environment), await fixture.missingAsync(["gti"], [], environment, bash, "s2")], [["gti"], ["gti"]]);
      assert.deepEqual(await fixture.missingAsync(["gti"], [], environment, bash, "s1", 1, new CommandTracker(() => "")), []);
      assert.deepEqual(await fixture.missingAsync(["gti"], [], environment, bash, "s1", 2), []);
      fixture.fileSystem.files.delete("/usr/bin/gti");
      assert.deepEqual(await fixture.missingAsync(["gti"], [], { PATH: "/opt/bin" }, bash, "s2"), []);
      assert.deepEqual(await fixture.missingAsync(["gti"], [], environment, bash, "s2"), ["gti"]);
    });

    it("gives none for a shell that reported no names, PowerShell and any other shell", async () => {
      const fixture: SourceFixture = new SourceFixture();

      assert.deepEqual(await fixture.missingAsync(["gti"], null), []);
      for (const kind of [TerminalShellKind.PowerShell, TerminalShellKind.Fish, TerminalShellKind.CommandPrompt, TerminalShellKind.Other])
        assert.deepEqual(await fixture.missingAsync(["gti"], [], {}, kind), []);
    });

    it("gives none once a PATH folder doesn't answer by the deadline, nor for that terminal until its read ends", async () => {
      vi.useFakeTimers();
      try {
        const fixture: SourceFixture = new SourceFixture();
        const stalled: PromiseWithResolvers<void> = Promise.withResolvers<void>();
        fixture.fileSystem.stalled.set("/share/bin", stalled.promise);
        fixture.fileSystem.files.set("/share/bin/gzip", "");
        const environment: Readonly<Record<string, string>> = { PATH: "/share/bin:/usr/bin" };

        const first: Promise<readonly string[]> = fixture.missingAsync(["gzip", "gti"], [], environment);
        await vi.advanceTimersByTimeAsync(1_000);
        assert.deepEqual(await first, []);
        assert.deepEqual(await fixture.missingAsync(["gti"]), []);
        assert.deepEqual(await fixture.missingAsync(["gti"], [], {}, TerminalShellKind.Bash, "s2"), ["gti"]);
        stalled.resolve();
        await vi.advanceTimersByTimeAsync(0);
        assert.deepEqual(await fixture.missingAsync(["gzip", "gti"], [], environment), ["gti"]);
      }
      finally {
        vi.useRealTimers();
      }
    });

    it("on Windows, finds a program by PATHEXT, a name typed in any case or with its extension, and for Git Bash a script without one", async () => {
      const fixture: SourceFixture = new SourceFixture("win32", "C:\\Users\\a");
      fixture.fileSystem.files.set("C:\\Tools\\Node.EXE", "");
      fixture.fileSystem.files.set("C:\\Tools\\start", "");
      const environment: Readonly<Record<string, string>> = { Path: "C:\\Tools", PathExt: ".EXE" };

      assert.deepEqual(await fixture.missingAsync(["node", "NODE.exe", "LL", "nodes", "start", "C:\\Tools\\nope"], ["ll"], environment), ["nodes"]);
      assert.deepEqual(await fixture.missingAsync(["start"], [], environment, TerminalShellKind.Zsh), ["start"]);
    });
  });

  describe("for names typed in PowerShell", () => {
    it("looks up the names it didn't report, as typed and with Get- in front, in the shell's program with its PATH, PATHEXT and PSModulePath", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.runner.answers.set(PWSH, "\uFEFF0\r\n3\r\n");
      const environment: Readonly<Record<string, string>> = { PATH: "/usr/bin", PSModulePath: "/opt/modules", HOME: "/home/a",
        PSExecutionPolicyPreference: "RemoteSigned" };

      assert.deepEqual(await fixture.powerShellMissingAsync(["gti", "LL", "Process", "process", "nope", "gti"], new Set(["ll", "Get-Mine"]), environment),
        ["gti", "nope"]);
      assert.deepEqual(fixture.lookups.map(t => t.split("\n")[1]), ["$names = @('gti', 'Process', 'process', 'nope')"]);
      assert.deepEqual(fixture.runner.environments, [{ PATH: "/usr/bin", PSModulePath: "/opt/modules" }]);
      assert.deepEqual(fixture.runner.runs.map(t => [t[1].slice(0, -1), t[2]]),
        [[["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand"], 10_000]]);
    });

    it("never asks about a path, a name a quote could end, a session function Get- names, nor anything for a shell that reported no names", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.runner.answers.set(PWSH, "");

      assert.deepEqual(await fixture.powerShellMissingAsync(["./run.ps1", "~/x", ".hidden", "it's", "mine"], new Set(["Get-Mine"])), []);
      assert.deepEqual(await fixture.powerShellMissingAsync(["gti"], null), []);
      assert.deepEqual(fixture.lookups, []);
    });

    it("keeps each shell's answers until it reports other names or another PATH or PSModulePath, and asks only about new names", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.runner.answers.set(PWSH, "0\n");
      const names: ReadonlySet<string> = new Set(["ll"]);
      const first: readonly string[] = await fixture.powerShellMissingAsync(["gti"], names, { PATH: "/usr/bin" });
      fixture.runner.answers.set(PWSH, "");

      const kept: readonly string[] = await fixture.powerShellMissingAsync(["gti", "ls"], names, { PATH: "/usr/bin" });
      const renamed: readonly string[] = await fixture.powerShellMissingAsync(["gti"], new Set(["ll"]), { PATH: "/usr/bin" });
      fixture.runner.answers.set(PWSH, "0\n");
      const other: readonly string[] = await fixture.powerShellMissingAsync(["gti"], names, { PATH: "/usr/bin" }, fixture.shellOf("s2"));
      const repathed: readonly string[] = await fixture.powerShellMissingAsync(["gti"], names, { PATH: "/usr/bin", PSModulePath: "/opt/m" });

      assert.deepEqual([first, kept, renamed, other, repathed], [["gti"], ["gti"], [], ["gti"], ["gti"]]);
      assert.deepEqual(fixture.lookups.map(t => t.split("\n")[1]),
        ["$names = @('gti')", "$names = @('ls')", "$names = @('gti')", "$names = @('gti')", "$names = @('gti')"]);
    });

    it("finds none missing once a lookup fails or runs past its time, logs why each time, and looks up again next time, but passes on a fault of its own", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.runner.answers.set(PWSH, new CommandTimedOutException("pwsh", 10_000));
      const names: ReadonlySet<string> = new Set(["ll"]);
      const failed: readonly string[] = await fixture.powerShellMissingAsync(["gti", "gzp"], names);
      fixture.runner.answers.set(PWSH, new CommandExitedException("pwsh", new ProcessExit(1, null), "Get-Command : broken\r\n"));
      const exited: readonly string[] = await fixture.powerShellMissingAsync(["gti"], names);
      fixture.runner.answers.set(PWSH, "0\n");

      assert.deepEqual([failed, exited, await fixture.powerShellMissingAsync(["gti"], names)], [[], [], ["gti"]]);
      assert.deepEqual(fixture.log.callsOf("write").map(t => t[0]), [
        "PowerShell's lookup of 2 names a command line runs gave up, so they count as found: pwsh did not end within 10 seconds.",
        "PowerShell's lookup of 1 name a command line runs gave up, so they count as found: pwsh exited with 1: Get-Command : broken"
      ]);
      fixture.runner.answers.set(PWSH, new TypeError("broken"));
      await assert.rejects(fixture.powerShellMissingAsync(["ls"], names), TypeError);
    });

    it("finds none missing for a session whose PATH or PSModulePath was reset, running nothing, and logs that once for the session", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.runner.answers.set(PWSH, "0\n");

      const reset: readonly (readonly string[])[] = [await fixture.powerShellMissingAsync(["gti"], null), await fixture.powerShellMissingAsync(["gzp"], null),
        await fixture.powerShellMissingAsync(["gti"], null, {}, fixture.shellOf("s2"))];

      assert.deepEqual([reset, fixture.lookups.length], [[[], [], []], 0]);
      assert.deepEqual(fixture.log.callsOf("write").map(t => t[0]), Array.from({ length: 2 }, () =>
        "PowerShell's lookup of the names a command line runs is skipped for a session whose PATH or PSModulePath was reset, so every name counts as found."));
    });

    it("on Windows, reads the variables whatever their case", async () => {
      const fixture: SourceFixture = new SourceFixture("win32", "C:\\Users\\a");
      fixture.runner.answers.set(PWSH, "");

      await fixture.powerShellMissingAsync(["gti"], new Set(), { Path: "C:\\Windows", PathExt: ".EXE", PsModulePath: "C:\\Modules" });

      assert.deepEqual(fixture.runner.environments, [{ PATH: "C:\\Windows", PATHEXT: ".EXE", PSModulePath: "C:\\Modules" }]);
    });

    it("on Windows, gives the lookup each PSModulePath folder written with a short 8.3 name in its long form, and one it can't read as it is", async () => {
      const fixture: SourceFixture = new SourceFixture("win32", "C:\\Users\\a");
      fixture.runner.answers.set(PWSH, "");
      fixture.fileSystem.realPaths.set("C:\\Users\\RUNNER~1\\Modules", "C:\\Users\\runneradmin\\Modules");
      fixture.fileSystem.realPaths.set("C:\\Program Files\\PowerShell\\Modules", "D:\\Elsewhere");

      await fixture.powerShellMissingAsync(["gti"], new Set(),
        { PSModulePath: "C:\\Users\\RUNNER~1\\Modules;C:\\Program Files\\PowerShell\\Modules;C:\\GONE~1\\Modules;" });

      assert.deepEqual(fixture.runner.environments,
        [{ PSModulePath: "C:\\Users\\runneradmin\\Modules;C:\\Program Files\\PowerShell\\Modules;C:\\GONE~1\\Modules;" }]);
    });

    it("on Windows, gives the lookup a PSModulePath folder as written when reading its real path fails with a system error, as on a RAM disk", async () => {
      const fixture: SourceFixture = new SourceFixture("win32", "C:\\Users\\a");
      fixture.runner.answers.set(PWSH, "0\r\n");
      fixture.fileSystem.realPathFailures.set("R:\\MODULE~1", Object.assign(new Error("EISDIR: illegal operation on a directory"), { code: "EISDIR" }));
      fixture.fileSystem.realPaths.set("C:\\Users\\RUNNER~1\\Modules", "C:\\Users\\runneradmin\\Modules");

      const missing: readonly string[] = await fixture.powerShellMissingAsync(["gti"], new Set(), { PSModulePath: "R:\\MODULE~1;C:\\Users\\RUNNER~1\\Modules" });

      assert.deepEqual([missing, fixture.runner.environments], [["gti"], [{ PSModulePath: "R:\\MODULE~1;C:\\Users\\runneradmin\\Modules" }]]);
    });

    it("on Windows, gives the lookup a PSModulePath folder as written when its real path doesn't come by the read's deadline", async () => {
      vi.useFakeTimers();
      try {
        const fixture: SourceFixture = new SourceFixture("win32", "C:\\Users\\a");
        fixture.runner.answers.set(PWSH, "");
        const stalled: PromiseWithResolvers<void> = Promise.withResolvers<void>();
        fixture.fileSystem.realPaths.set("N:\\SHARE~1\\Modules", "N:\\Shared Modules\\Modules");
        fixture.fileSystem.stalled.set("N:\\SHARE~1\\Modules", stalled.promise);

        const missing: Promise<readonly string[]> = fixture.powerShellMissingAsync(["gti"], new Set(), { PSModulePath: "N:\\SHARE~1\\Modules" });
        await vi.advanceTimersByTimeAsync(999);
        const ranEarly: boolean = fixture.runner.runs.length > 0;
        await vi.advanceTimersByTimeAsync(1);

        assert.deepEqual([ranEarly, await missing, fixture.runner.environments], [false, [], [{ PSModulePath: "N:\\SHARE~1\\Modules" }]]);
        stalled.resolve();
      }
      finally {
        vi.useRealTimers();
      }
    });

    it("leaves a PSModulePath folder with a ~ in its name as it is off Windows", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.runner.answers.set(PWSH, "");
      fixture.fileSystem.realPaths.set("/opt/a~1", "/opt/long");

      await fixture.powerShellMissingAsync(["gti"], new Set(), { PSModulePath: "/opt/a~1" });

      assert.deepEqual(fixture.runner.environments, [{ PSModulePath: "/opt/a~1" }]);
    });

    it("reads the lookup's answer as the indexes of the names it asked about, so a name outside the console's code page comes back", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.runner.answers.set(PWSH, "1\r\nünïcode\r\n7\r\n");

      assert.deepEqual(await fixture.powerShellMissingAsync(["gti", "ünïcode", "ls"], new Set()), ["ünïcode"]);
      assert.deepEqual(fixture.lookups.map(t => t.split("\n")[1]), ["$names = @('gti', 'ünïcode', 'ls')"]);
    });

    it("asks for each name only as a wildcard, one that matches it alone as a command, and one for a program or script with or without an extension", () => {
      const script: string = Resources.formatPowerShellLookupScript(["gti"]);

      assert.deepEqual(script.split("\n").filter(t => t.includes("Get-Command") || t.startsWith("$patterns =") || t.startsWith("$files =")), [
        "$patterns = foreach ($candidate in $candidates) { '[' + $candidate.Substring(0, 1) + ']' + $candidate.Substring(1) }",
        "$files = foreach ($candidate in $candidates) { \"$candidate*\" }",
        "foreach ($command in @(Get-Command -Name $patterns) + @(Get-Command -Name $files -CommandType Application, ExternalScript)) {"
      ]);
    });
  });

  describe("for git", () => {
    const environment: Readonly<Record<string, string>> = { PATH: "/usr/bin" };

    it("lists the local and remote branches, without the remotes' HEAD, after checkout, switch, merge and rebase", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.fileSystem.files.set("/usr/bin/git", "");
      fixture.runner.answers.set("/usr/bin/git",
        "refs/heads/main\nrefs/heads/feature/x\nrefs/remotes/origin/HEAD\nrefs/remotes/origin/main\nrefs/stash\n");

      for (const command of ["checkout", "switch", "merge", "rebase"])
        assert.deepEqual(await fixture.choicesAsync(`git ${command} `, "/work", environment), [
          ["feature/x", "feature/x", "Branch"],
          ["main", "main", "Branch"],
          ["origin/main", "origin/main", "Branch"]
        ]);
      assert.deepEqual(fixture.runner.runs[0], ["/usr/bin/git", ["-C", "/work", "for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes"], 2_000]);
      assert.deepEqual(await fixture.choicesAsync("git switch ma", "/work", environment), [["main", "main", "Branch"]]);
    });

    it("lists paths after other commands and after a branch, and no branches where git isn't on PATH or fails", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.fileSystem.files.set("/work/main.c", "");

      assert.deepEqual(await fixture.choicesAsync("git checkout ma", "/work", environment), []);
      assert.equal(fixture.runner.runs.length, 0);
      fixture.fileSystem.files.set("/usr/bin/git", "");
      assert.deepEqual(await fixture.choicesAsync("git checkout ma", "/work", environment), []);
      assert.equal(fixture.runner.runs.length, 1);
      fixture.runner.answers.set("/usr/bin/git", "refs/heads/main\n");
      assert.deepEqual(await fixture.choicesAsync("git log ma", "/work", environment), [["main.c", "main.c", "File"]]);
      assert.deepEqual(await fixture.choicesAsync("git checkout main ma", "/work", environment), [["main.c", "main.c", "File"]]);
    });

    it("passes on a failure that isn't git's", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.fileSystem.files.set("/usr/bin/git", "");
      fixture.runner.answers.set("/usr/bin/git", new RangeError("broken"));

      await assert.rejects(fixture.choicesAsync("git checkout ", "/work", environment), RangeError);
    });
  });

  describe("for npm run", () => {
    it("lists the scripts of the nearest package.json up from the working folder, and paths after npm's other commands", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.fileSystem.files.set("/work/app/package.json", JSON.stringify({ scripts: { test: "vitest", build: "tsc" } }));
      fixture.fileSystem.files.set("/work/package.json", JSON.stringify({ scripts: { root: "x" } }));

      assert.deepEqual(await fixture.choicesAsync("npm run ", "/work/app/src"), [["build", "build", "Script"], ["test", "test", "Script"]]);
      assert.deepEqual(await fixture.choicesAsync("npm run-script t", "/work/app"), [["test", "test", "Script"]]);
      fixture.fileSystem.files.set("/work/app/src/build.ts", "");
      assert.deepEqual(await fixture.choicesAsync("npm install b", "/work/app/src"), [["build.ts", "build.ts", "File"]]);
    });

    it("lists none for a package.json that isn't JSON or has no scripts object, nor without one", async () => {
      const fixture: SourceFixture = new SourceFixture();

      assert.deepEqual(await fixture.choicesAsync("npm run ", "/work"), []);
      for (const text of ["{", "null", "[]", "{\"name\":\"a\"}", "{\"scripts\":null}", "{\"scripts\":[\"a\"]}", "{\"scripts\":\"a\"}"]) {
        fixture.fileSystem.files.set("/work/package.json", text);
        assert.deepEqual(await fixture.choicesAsync("npm run ", "/work"), [], text);
      }
    });

    it("passes on a failure to read package.json other than text that isn't JSON", async () => {
      const fixture: SourceFixture = new SourceFixture();
      fixture.fileSystem.files.set("/work/package.json", "{}");
      const parse: MockInstance<typeof JSON.parse> = vi.spyOn(JSON, "parse").mockImplementation(() => {
        throw new RangeError("broken");
      });
      try {
        await assert.rejects(fixture.choicesAsync("npm run ", "/work"), RangeError);
      }
      finally {
        parse.mockRestore();
      }
    });
  });

  describe("on Windows", () => {
    it("lists PATH's programs by PATHEXT, whatever the variables' case, without their extension, and builtins in any case", async () => {
      const fixture: SourceFixture = new SourceFixture("win32", "C:\\Users\\a");
      fixture.fileSystem.files.set("C:\\Tools\\npm.cmd", "");
      fixture.fileSystem.files.set("C:\\Tools\\Node.EXE", "");
      fixture.fileSystem.files.set("C:\\Tools\\notes.txt", "");
      const environment: Readonly<Record<string, string>> = { Path: "C:\\Tools", PathExt: ".EXE;.CMD;" };

      assert.deepEqual(await fixture.choicesAsync("n", "C:\\work", environment, TerminalShellKind.PowerShell), [
        ["New-Item", "New-Item", "Command"],
        ["Node", "Node", "Command"],
        ["npm", "npm", "Command"]
      ]);
      assert.deepEqual(await fixture.choicesAsync("note", "C:\\work", { PATH: "C:\\Tools" }, TerminalShellKind.PowerShell), []);
      fixture.fileSystem.files.set("C:\\Tools\\notepad.com", "");
      assert.deepEqual(await fixture.choicesAsync("note", "C:\\work", { PATH: "C:\\Tools" }, TerminalShellKind.PowerShell),
        [["notepad", "notepad", "Command"]]);
    });

    it("lists PowerShell's paths with its separator, quoted where they must be, from the home folder too", async () => {
      const fixture: SourceFixture = new SourceFixture("win32", "C:\\Users\\a");
      fixture.fileSystem.folders.add("C:\\work\\My Docs");
      fixture.fileSystem.folders.add("C:\\Users\\a\\Desktop");
      fixture.fileSystem.files.set("C:\\Tools\\npm.cmd", "");

      assert.deepEqual(await fixture.completeAsync("cd m", "C:\\work", {}, TerminalShellKind.PowerShell), [3, [["'My Docs\\", "My Docs\\", "Folder"]]]);
      assert.deepEqual(await fixture.choicesAsync("cd ~\\D", "C:\\work", {}, TerminalShellKind.PowerShell), [["~\\Desktop\\", "Desktop\\", "Folder"]]);
      assert.deepEqual(await fixture.choicesAsync("cd ~/D", "C:\\work", {}, TerminalShellKind.PowerShell), [["~/Desktop/", "Desktop/", "Folder"]]);
      assert.deepEqual(await fixture.choicesAsync("C:\\Tools\\N", "C:\\work", {}, TerminalShellKind.PowerShell), [["C:\\Tools\\npm.cmd", "npm.cmd", "File"]]);
    });

    it("reads Git Bash's drive paths, and lists nothing for its paths outside a drive", async () => {
      const fixture: SourceFixture = new SourceFixture("win32", "C:\\Users\\a");
      fixture.fileSystem.folders.add("C:\\work\\src");
      fixture.fileSystem.folders.add("D:\\data");
      fixture.fileSystem.folders.add("C:\\work");

      assert.deepEqual(await fixture.choicesAsync("cd s", "/c/work"), [["src/", "src/", "Folder"]]);
      assert.deepEqual(await fixture.choicesAsync("cd w", "/c"), [["work/", "work/", "Folder"]]);
      assert.deepEqual(await fixture.choicesAsync("cd /d/", "/c/work"), [["/d/data/", "data/", "Folder"]]);
      assert.deepEqual(await fixture.choicesAsync("cd /usr/", "/c/work"), []);
      assert.deepEqual(await fixture.choicesAsync("cd ", "/usr/share"), []);
      assert.deepEqual(await fixture.choicesAsync("git checkout ", "/usr/share", { PATH: "C:\\Git\\cmd" }), []);
    });

    it("reads Git Bash's /tmp as the temporary folder TEMP names, and lists nothing there without an absolute TEMP", async () => {
      const fixture: SourceFixture = new SourceFixture("win32", "C:\\Users\\a");
      fixture.fileSystem.folders.add("C:\\Temp\\names");
      fixture.fileSystem.files.set("C:\\Temp\\names\\a b", "");
      fixture.fileSystem.files.set("C:\\Temp\\top", "");
      const environment: Readonly<Record<string, string>> = { Temp: "C:\\Temp" };

      assert.deepEqual(await fixture.choicesAsync("cat a", "/tmp/names", environment), [["a\\ b", "a b", "File"]]);
      assert.deepEqual(await fixture.choicesAsync("cat /tmp/t", "/c/work", environment), [["/tmp/top", "top", "File"]]);
      assert.deepEqual(await fixture.choicesAsync("cat t", "/tmp", environment), [["top", "top", "File"]]);
      assert.deepEqual(await fixture.choicesAsync("cat t", "/tmpx", environment), []);
      assert.deepEqual(await fixture.choicesAsync("cat t", "/tmp", { TEMP: "Temp" }), []);
      assert.deepEqual(await fixture.choicesAsync("cat t", "/tmp"), []);
    });

    it("lists branches and scripts after a command typed with its extension, in any case", async () => {
      const fixture: SourceFixture = new SourceFixture("win32", "C:\\Users\\a");
      fixture.fileSystem.files.set("C:\\Git\\cmd\\git.exe", "");
      fixture.runner.answers.set("C:\\Git\\cmd\\git.exe", "refs/heads/main\r\n");
      fixture.fileSystem.files.set("C:\\work\\package.json", "{\"scripts\":{\"build\":\"tsc\"}}");
      const environment: Readonly<Record<string, string>> = { PATH: "C:\\Git\\cmd" };

      assert.deepEqual(await fixture.choicesAsync("Git.exe checkout ", "/c/work", environment), [["main", "main", "Branch"]]);
      assert.deepEqual(fixture.runner.runs[0]?.[1][1], "C:\\work");
      assert.deepEqual(await fixture.choicesAsync("NPM.cmd run ", "C:\\work", environment, TerminalShellKind.PowerShell), [["build", "build", "Script"]]);
    });
  });
});
