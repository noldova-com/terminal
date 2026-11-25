/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import assert from "node:assert/strict";
import type { UserInfo } from "node:os";

import { ProcessExit } from "@noldova/desktop.runtime";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { TerminalShellKind } from "@noldova/terminal.protocol";
import { afterEach, describe, it, type Mock, vi } from "vitest";

import { CommandExitedException } from "../../src/exceptions/command-exited.exception.ts";
import type { Shell } from "../../src/models/shell.ts";
import { Resources } from "../../src/resources.ts";
import { ShellLocator } from "../../src/services/shell-locator.ts";
import { FakeCommandRunner } from "../fixtures/fake-command-runner.fixture.ts";
import { FakeFileSystemReader } from "../fixtures/fake-file-system-reader.fixture.ts";
import { RecordedRun } from "../fixtures/recorded-run.fixture.ts";

const userShell: Mock<() => string | null> = vi.hoisted(() => vi.fn<() => string | null>());

vi.mock("node:os", async importOriginal => {
  const actual: typeof import("node:os") = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    userInfo: (): UserInfo<string> => {
      const read: (() => string | null) | undefined = userShell.getMockImplementation();
      return Object.isUndefined(read) ? actual.userInfo() : { ...actual.userInfo(), shell: read() };
    }
  };
});

function describeShells(shells: readonly Shell[]): string[] {
  return shells.map(t => `${t.id}|${t.name}|${t.kind}|${t.file}|${t.args.join(" ")}|${t.isDefault ? "default" : ""}`);
}

function createLocator(platform: string, environment: Readonly<Record<string, string | undefined>>, fileSystem: FakeFileSystemReader,
  runner: FakeCommandRunner = new FakeCommandRunner(), architecture: string = "x64", log: FakeModuleLog = new FakeModuleLog(),
  userShell: string | null = null): ShellLocator {
  return new ShellLocator(platform, architecture, environment, userShell, fileSystem, runner, log);
}

describe("ShellLocator", () => {
  describe("on Windows", () => {
    const environment: Readonly<Record<string, string | undefined>> = {
      ProgramFiles: "C:\\Program Files",
      SystemRoot: "C:\\Windows",
      PATH: "C:\\Tools;;C:\\Other"
    };

    it("finds PowerShell 7, Windows PowerShell, Command Prompt and Git Bash, the first one found by default", async () => {
      const fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
      for (const file of [
        "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
        "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
        "C:\\Windows\\System32\\cmd.exe",
        "C:\\Program Files\\Git\\bin\\bash.exe"
      ])
        fileSystem.files.set(file, "");

      assert.deepEqual(describeShells(await createLocator("win32", environment, fileSystem).locateAsync()), [
        "pwsh|PowerShell|PowerShell|C:\\Program Files\\PowerShell\\7\\pwsh.exe||default",
        "powershell|Windows PowerShell|PowerShell|C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe||",
        "cmd|Command Prompt|CommandPrompt|C:\\Windows\\System32\\cmd.exe||",
        "git-bash|Git Bash|Bash|C:\\Program Files\\Git\\bin\\bash.exe|--login -i|"
      ]);
    });

    it("finds PowerShell 7 on the search path", async () => {
      const fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
      fileSystem.files.set("C:\\Other\\pwsh.exe", "");
      fileSystem.files.set("C:\\Windows\\System32\\cmd.exe", "");

      assert.deepEqual(describeShells(await createLocator("win32", environment, fileSystem).locateAsync()), [
        "pwsh|PowerShell|PowerShell|C:\\Other\\pwsh.exe||default",
        "cmd|Command Prompt|CommandPrompt|C:\\Windows\\System32\\cmd.exe||"
      ]);
    });

    it("finds the Store install of PowerShell 7, an app execution alias, in the person's WindowsApps folder or on the search path", async () => {
      const aliases: string = "C:\\Users\\Person\\AppData\\Local\\Microsoft\\WindowsApps";
      const fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
      fileSystem.aliases.add(`${aliases}\\pwsh.exe`);
      fileSystem.files.set("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", "");

      assert.deepEqual(describeShells(await createLocator("win32", { ...environment, LOCALAPPDATA: "C:\\Users\\Person\\AppData\\Local" }, fileSystem).locateAsync()), [
        `pwsh|PowerShell|PowerShell|${aliases}\\pwsh.exe||default`,
        "powershell|Windows PowerShell|PowerShell|C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe||"
      ]);
      assert.deepEqual(describeShells(await createLocator("win32", { PATH: `C:\\Tools;${aliases}` }, fileSystem).locateAsync()), [
        `pwsh|PowerShell|PowerShell|${aliases}\\pwsh.exe||default`
      ]);
    });

    it("prefers PowerShell 7 in Program Files, then on the search path, to its Store install", async () => {
      const fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
      fileSystem.files.set("C:\\Other\\pwsh.exe", "");
      fileSystem.aliases.add("C:\\Local\\Microsoft\\WindowsApps\\pwsh.exe");
      const shellsAsync = async (): Promise<string[]> => describeShells(await createLocator("win32", { ...environment, LOCALAPPDATA: "C:\\Local" }, fileSystem).locateAsync());

      assert.deepEqual(await shellsAsync(), ["pwsh|PowerShell|PowerShell|C:\\Other\\pwsh.exe||default"]);
      fileSystem.files.set("C:\\Program Files\\PowerShell\\7\\pwsh.exe", "");
      assert.deepEqual(await shellsAsync(), ["pwsh|PowerShell|PowerShell|C:\\Program Files\\PowerShell\\7\\pwsh.exe||default"]);
    });

    it("finds Git Bash in its machine, 32-bit and per-user install folders, and beside Git's cmd folder on the search path, in that order", async () => {
      const folders: Readonly<Record<string, string | undefined>> = {
        ...environment,
        "ProgramFiles(x86)": "C:\\Program Files (x86)",
        LOCALAPPDATA: "C:\\Users\\Person\\AppData\\Local",
        PATH: "Git\\cmd;D:\\Other\\cmd;D:\\Tools\\Git\\CMD\\"
      };
      const fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
      for (const file of ["Git\\cmd\\git.exe", "Git\\bin\\bash.exe", "D:\\Other\\bin\\bash.exe", "D:\\Tools\\Git\\CMD\\git.exe", "D:\\Tools\\Git\\bin\\bash.exe"])
        fileSystem.files.set(file, "");
      const gitBashAsync = async (): Promise<string | undefined> => (await createLocator("win32", folders, fileSystem).locateAsync()).find(t => t.id === "git-bash")?.file;

      assert.equal(await gitBashAsync(), "D:\\Tools\\Git\\bin\\bash.exe");
      fileSystem.files.set("C:\\Users\\Person\\AppData\\Local\\Programs\\Git\\bin\\bash.exe", "");
      assert.equal(await gitBashAsync(), "C:\\Users\\Person\\AppData\\Local\\Programs\\Git\\bin\\bash.exe");
      fileSystem.files.set("C:\\Program Files (x86)\\Git\\bin\\bash.exe", "");
      assert.equal(await gitBashAsync(), "C:\\Program Files (x86)\\Git\\bin\\bash.exe");
      fileSystem.files.set("C:\\Program Files\\Git\\bin\\bash.exe", "");
      assert.equal(await gitBashAsync(), "C:\\Program Files\\Git\\bin\\bash.exe");
    });

    it("looks for PowerShell 7 only in absolute search path folders", async () => {
      const fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
      for (const file of ["pwsh.exe", ".\\pwsh.exe", "tools\\pwsh.exe", "C:\\Safe\\pwsh.exe"])
        fileSystem.files.set(file, "");

      assert.deepEqual(describeShells(await createLocator("win32", { PATH: ".;tools;C:\\Safe" }, fileSystem).locateAsync()), [
        "pwsh|PowerShell|PowerShell|C:\\Safe\\pwsh.exe||default"
      ]);
    });

    it("skips folders that are not set", async () => {
      const fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
      fileSystem.files.set("\\System32\\cmd.exe", "");

      assert.deepEqual(await createLocator("win32", { ProgramFiles: "", SystemRoot: "" }, fileSystem).locateAsync(), []);
    });

    describe("with WSL and Visual Studio", () => {
      const powerShell: string = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
      const vswhere: string = "C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe";
      const listed: Readonly<Record<string, string | undefined>> = { ...environment, "ProgramFiles(x86)": "C:\\Program Files (x86)" };
      const line = (name: string, isDefault: boolean): string => `${Buffer.from(name, "utf8").toString("base64")} ${isDefault ? "1" : "0"}`;
      const installations: string = JSON.stringify([
        { instanceId: "a1", displayName: "Visual Studio Community 2026", installationPath: "C:\\VS\\Community" },
        { instanceId: "b2", displayName: "Visual Studio Build Tools 2022", installationPath: "D:\\Build Tools" }
      ]);

      function install(files: readonly string[]): FakeFileSystemReader {
        const fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
        for (const file of files)
          fileSystem.files.set(file, "");
        return fileSystem;
      }

      it("lists each WSL distribution but Docker's after the installed shells, the default first, each in wsl.exe with its name", async () => {
        const runner: FakeCommandRunner = new FakeCommandRunner();
        runner.answers.set(powerShell, [line("docker-desktop", false), line("Debian", false), line("Ubuntu", true), line("docker-desktop-data", false), "End", ""].join("\r\n"));

        assert.deepEqual(describeShells(await createLocator("win32", environment, install([powerShell]), runner).locateAsync()), [
          `powershell|Windows PowerShell|PowerShell|${powerShell}||default`,
          "wsl-Ubuntu|Ubuntu|Wsl|C:\\Windows\\System32\\wsl.exe|-d Ubuntu|",
          "wsl-Debian|Debian|Wsl|C:\\Windows\\System32\\wsl.exe|-d Debian|"
        ]);
        assert.deepEqual(runner.runs.map(t => [t.file, t.args.slice(0, 4), Buffer.from(t.args[4] ?? "", "base64").toString("utf16le"), t.timeoutMilliseconds]),
          [[powerShell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand"], Resources.wslDistributionScript, 60_000]]);
      });

      it("lists each Visual Studio installation's Developer Command Prompt and Developer PowerShell, in PowerShell 7 when it is installed", async () => {
        const runner: FakeCommandRunner = new FakeCommandRunner();
        runner.answers.set(powerShell, "End\r\n");
        runner.answers.set(vswhere, installations);
        const fileSystem: FakeFileSystemReader = install([
          "C:\\Program Files\\PowerShell\\7\\pwsh.exe", powerShell, "C:\\Windows\\System32\\cmd.exe", vswhere,
          "C:\\VS\\Community\\Common7\\Tools\\VsDevCmd.bat", "C:\\VS\\Community\\Common7\\Tools\\Microsoft.VisualStudio.DevShell.dll",
          "D:\\Build Tools\\Common7\\Tools\\VsDevCmd.bat"
        ]);

        const shells: readonly Shell[] = await createLocator("win32", listed, fileSystem, runner).locateAsync();

        assert.deepEqual(describeShells(shells).slice(3), [
          "vs-a1-cmd|Developer Command Prompt (Visual Studio Community 2026)|CommandPrompt|C:\\Windows\\System32\\cmd.exe|" +
            "/k C:\\VS\\Community\\Common7\\Tools\\VsDevCmd.bat -startdir=none -arch=amd64 -host_arch=amd64|",
          "vs-a1-powershell|Developer PowerShell (Visual Studio Community 2026)|PowerShell|C:\\Program Files\\PowerShell\\7\\pwsh.exe||",
          "vs-b2-cmd|Developer Command Prompt (Visual Studio Build Tools 2022)|CommandPrompt|C:\\Windows\\System32\\cmd.exe|" +
            "/k D:\\Build Tools\\Common7\\Tools\\VsDevCmd.bat -startdir=none -arch=amd64 -host_arch=amd64|"
        ]);
        assert.deepEqual(shells.map(t => t.startCommand).filter(t => !Object.isNull(t)), [
          "& { Microsoft.PowerShell.Core\\Import-Module 'C:\\VS\\Community\\Common7\\Tools\\Microsoft.VisualStudio.DevShell.dll'; " +
            "Microsoft.VisualStudio.DevShell\\Enter-VsDevShell -VsInstallPath 'C:\\VS\\Community' -SkipAutomaticLocation -DevCmdArguments '-arch=amd64 -host_arch=amd64' }"
        ]);
        assert.deepEqual(runner.runs.filter(t => t.file === vswhere), [new RecordedRun(vswhere, ["-products", "*", "-prerelease", "-utf8", "-format", "json"], 60_000)]);
      });

      it("runs a Developer PowerShell in Windows PowerShell without PowerShell 7, passes an architecture VsDevCmd doesn't name as it is, and leaves out a developer shell whose shell isn't installed", async () => {
        const runner: FakeCommandRunner = new FakeCommandRunner();
        runner.answers.set(powerShell, "End");
        runner.answers.set(vswhere, JSON.stringify([{ instanceId: "c3", displayName: "Visual Studio's Preview", installationPath: "C:\\It's VS" }]));
        const fileSystem: FakeFileSystemReader = install([
          powerShell, vswhere, "C:\\It's VS\\Common7\\Tools\\VsDevCmd.bat", "C:\\It's VS\\Common7\\Tools\\Microsoft.VisualStudio.DevShell.dll"
        ]);

        const shells: readonly Shell[] = await createLocator("win32", listed, fileSystem, runner, "arm").locateAsync();

        assert.deepEqual(describeShells(shells).slice(1), [`vs-c3-powershell|Developer PowerShell (Visual Studio's Preview)|PowerShell|${powerShell}||`]);
        assert.equal(shells[1]?.startCommand, "& { Microsoft.PowerShell.Core\\Import-Module 'C:\\It''s VS\\Common7\\Tools\\Microsoft.VisualStudio.DevShell.dll'; " +
          "Microsoft.VisualStudio.DevShell\\Enter-VsDevShell -VsInstallPath 'C:\\It''s VS' -SkipAutomaticLocation -DevCmdArguments '-arch=arm -host_arch=arm' }");
        assert.deepEqual(describeShells(await createLocator("win32", listed, install([vswhere, "C:\\Windows\\System32\\cmd.exe"]), runner).locateAsync()),
          ["cmd|Command Prompt|CommandPrompt|C:\\Windows\\System32\\cmd.exe||default"]);
      });

      it("reads each list once, and logs a list that fails to read, lists the other shells without it and reads it again the next time", async () => {
        const runner: FakeCommandRunner = new FakeCommandRunner();
        const log: FakeModuleLog = new FakeModuleLog();
        runner.answers.set(powerShell, new CommandExitedException("powershell.exe", new ProcessExit(1, null)));
        runner.answers.set(vswhere, "{}");
        const locator: ShellLocator = createLocator("win32", listed, install([powerShell, "C:\\Windows\\System32\\cmd.exe", vswhere]), runner, "x64", log);

        assert.deepEqual((await locator.locateAsync()).map(t => t.id), ["powershell", "cmd"]);
        assert.deepEqual(log.callsOf("write").map(t => t[0]), [
          "The shell list leaves out the WSL distributions, which could not be read. powershell.exe exited with 1.",
          "The shell list leaves out Visual Studio's developer shells, since its installations could not be read."
        ]);
        runner.answers.set(powerShell, `${line("Ubuntu", true)}\nEnd\n`);
        runner.answers.set(vswhere, "[]");
        assert.deepEqual((await locator.locateAsync()).map(t => t.id), ["powershell", "cmd", "wsl-Ubuntu"]);
        assert.deepEqual((await locator.locateAsync()).map(t => t.id), ["powershell", "cmd", "wsl-Ubuntu"]);
        assert.deepEqual(runner.runs.map(t => t.file), [powerShell, vswhere, powerShell, vswhere]);
        assert.equal(log.callsOf("write").map(t => t[0]).length, 2);
      });

      it("logs a list that fails with something other than an error, as it is", async () => {
        const log: FakeModuleLog = new FakeModuleLog();
        const fileSystem: FakeFileSystemReader = new (class extends FakeFileSystemReader {
          public override isFileAsync(file: string): Promise<boolean> {
            return file === vswhere ? Promise.reject("denied") : super.isFileAsync(file);
          }
        })();
        fileSystem.files.set(powerShell, "");
        const runner: FakeCommandRunner = new FakeCommandRunner();
        runner.answers.set(powerShell, "End");

        assert.deepEqual((await createLocator("win32", listed, fileSystem, runner, "x64", log).locateAsync()).map(t => t.id), ["powershell"]);
        assert.deepEqual(log.callsOf("write").map(t => t[0]), ["denied"]);
      });

      it("finds no default shell without an installed one, and reads no list for it", async () => {
        const runner: FakeCommandRunner = new FakeCommandRunner();

        assert.equal(await createLocator("win32", { ProgramFiles: "", SystemRoot: "" }, new FakeFileSystemReader(), runner).findAsync(null), undefined);
        assert.deepEqual(runner.runs, []);
      });

      it("finds an installed shell and the default shell without waiting for the lists, and a listed shell once they are read", async () => {
        const runner: FakeCommandRunner = new FakeCommandRunner();
        let answer: (output: string) => void = () => undefined;
        runner.answers.set(powerShell, new Promise<string>(resolve => {
          answer = resolve;
        }));
        const locator: ShellLocator = createLocator("win32", environment, install([powerShell]), runner);

        assert.equal((await locator.findAsync("powershell"))?.file, powerShell);
        assert.equal((await locator.findAsync(null))?.id, "powershell");
        const finding: Promise<Shell | undefined> = locator.findAsync("wsl-Ubuntu");
        const missing: Promise<Shell | undefined> = locator.findAsync("wsl-Gone");
        answer(`${line("Ubuntu", true)}\nEnd\n`);

        assert.deepEqual((await finding)?.args, ["-d", "Ubuntu"]);
        assert.equal(await missing, undefined);
      });

      it("finds the first installed shell of the kinds without waiting for the lists, else the first listed one once they are read", async () => {
        const runner: FakeCommandRunner = new FakeCommandRunner();
        let answer: (output: string) => void = () => undefined;
        runner.answers.set(powerShell, new Promise<string>(resolve => {
          answer = resolve;
        }));
        const locator: ShellLocator = createLocator("win32", environment, install([powerShell, "C:\\Windows\\System32\\cmd.exe"]), runner);

        assert.equal((await locator.findKindAsync([TerminalShellKind.Bash, TerminalShellKind.CommandPrompt]))?.id, "cmd");
        const finding: Promise<Shell | undefined> = locator.findKindAsync([TerminalShellKind.Wsl]);
        const missing: Promise<Shell | undefined> = locator.findKindAsync([TerminalShellKind.Fish]);
        answer(`${line("Ubuntu", true)}\nEnd\n`);

        assert.equal((await finding)?.id, "wsl-Ubuntu");
        assert.equal(await missing, undefined);
      });
    });
  });

  describe("on macOS and Linux", () => {
    it("lists the person's shell first, then the system's shells once each", async () => {
      const fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
      fileSystem.files.set("/etc/shells", "# shells\n/bin/sh\n/bin/bash\n\n/usr/bin/bash\n  /usr/bin/zsh  \n/usr/bin/fish\n");
      for (const file of ["/bin/sh", "/bin/bash", "/usr/bin/bash", "/usr/bin/zsh"])
        fileSystem.files.set(file, "");

      assert.deepEqual(describeShells(await createLocator("linux", { SHELL: "/usr/bin/zsh" }, fileSystem).locateAsync()), [
        "zsh|zsh|Zsh|/usr/bin/zsh|-l|default",
        "sh|sh|Other|/bin/sh|-l|",
        "bash|bash|Bash|/bin/bash|-l|"
      ]);
    });

    it("gives each shell its kind by its file name, and any shell it doesn't know the kind Other", async () => {
      const fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
      const listed: readonly string[] = ["/bin/bash", "/bin/zsh", "/usr/local/bin/fish", "/usr/local/bin/pwsh", "/bin/ksh"];
      fileSystem.files.set("/etc/shells", listed.join("\n"));
      for (const file of listed)
        fileSystem.files.set(file, "");

      assert.deepEqual((await createLocator("darwin", {}, fileSystem).locateAsync()).map(t => [t.id, t.kind]),
        [["bash", "Bash"], ["zsh", "Zsh"], ["fish", "Fish"], ["pwsh", "PowerShell"], ["ksh", "Other"]]);
    });

    it("starts login shells on macOS and Linux, so they read the person's login profile", async () => {
      const fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
      fileSystem.files.set("/bin/zsh", "");

      assert.deepEqual(describeShells(await createLocator("darwin", { SHELL: "/bin/zsh" }, fileSystem).locateAsync()), ["zsh|zsh|Zsh|/bin/zsh|-l|default"]);
      assert.deepEqual(describeShells(await createLocator("linux", { SHELL: "/bin/zsh" }, fileSystem).locateAsync()), ["zsh|zsh|Zsh|/bin/zsh|-l|default"]);
    });

    it("leaves out the programs the shells file lists that aren't shells, unless the person chose one", async () => {
      const fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
      const listed: readonly string[] = ["/usr/bin/tmux", "/usr/bin/screen", "/usr/bin/git-shell", "/usr/sbin/nologin", "/bin/false", "/bin/bash"];
      fileSystem.files.set("/etc/shells", listed.join("\n"));
      for (const file of listed)
        fileSystem.files.set(file, "");

      assert.deepEqual(describeShells(await createLocator("linux", {}, fileSystem).locateAsync()), ["bash|bash|Bash|/bin/bash|-l|default"]);
      assert.deepEqual(describeShells(await createLocator("linux", { SHELL: "/usr/bin/tmux" }, fileSystem).locateAsync()), [
        "tmux|tmux|Other|/usr/bin/tmux|-l|default",
        "bash|bash|Bash|/bin/bash|-l|"
      ]);
    });

    it("lists nothing without a shell or a shells file", async () => {
      assert.deepEqual(await createLocator("linux", {}, new FakeFileSystemReader()).locateAsync(), []);
    });

    it("skips a shell variable that names no file", async () => {
      const fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
      fileSystem.files.set("/etc/shells", "/bin/bash\n/\n");
      fileSystem.files.set("/bin/bash", "");
      fileSystem.files.set("/", "");

      assert.deepEqual(describeShells(await createLocator("linux", { SHELL: "/opt/gone/zsh" }, fileSystem).locateAsync()), ["bash|bash|Bash|/bin/bash|-l|default"]);
    });

    it("lists the person's login shell from the user database before the shell variable's", async () => {
      const fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
      fileSystem.files.set("/etc/shells", "/bin/bash\n/bin/zsh\n");
      fileSystem.files.set("/bin/bash", "");
      fileSystem.files.set("/bin/zsh", "");

      assert.deepEqual((await createLocator("linux", { SHELL: "/bin/bash" }, fileSystem, new FakeCommandRunner(), "x64", new FakeModuleLog(), "/bin/zsh").locateAsync())
        .map(t => t.id), ["zsh", "bash"]);
    });

    it("finds a shell by its id, and the default shell for none", async () => {
      const fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
      fileSystem.files.set("/etc/shells", "/bin/bash\n/bin/zsh\n");
      fileSystem.files.set("/bin/bash", "");
      fileSystem.files.set("/bin/zsh", "");
      const locator: ShellLocator = createLocator("darwin", { SHELL: "/bin/zsh" }, fileSystem);

      assert.deepEqual([(await locator.findAsync("bash"))?.file, (await locator.findAsync(null))?.id, await locator.findAsync("fish")], ["/bin/bash", "zsh", undefined]);
    });

    it("finds the first shell of the kinds, in the order it lists them", async () => {
      const fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
      fileSystem.files.set("/etc/shells", "/bin/bash\n/bin/zsh\n");
      fileSystem.files.set("/bin/bash", "");
      fileSystem.files.set("/bin/zsh", "");
      const locator: ShellLocator = createLocator("linux", { SHELL: "/bin/zsh" }, fileSystem);

      assert.deepEqual([(await locator.findKindAsync([TerminalShellKind.Bash, TerminalShellKind.Zsh]))?.id,
        await locator.findKindAsync([TerminalShellKind.Fish])], ["zsh", undefined]);
    });
  });

  describe("the person's login shell", () => {
    afterEach(() => {
      userShell.mockReset();
    });

    it("is the shell the user database names, or null when it names none or can't be read", () => {
      const read = (shell: () => string | null): string | null => {
        userShell.mockImplementation(shell);
        return ShellLocator.readUserShell();
      };

      assert.deepEqual([
        read(() => "/bin/zsh"),
        read(() => null),
        read(() => " "),
        read(() => {
          throw Object.assign(new Error("A system error occurred: uv_os_get_passwd returned ENOENT"), { code: "ERR_SYSTEM_ERROR" });
        })
      ], ["/bin/zsh", null, null, null]);
    });

    it("reads this computer's user database for the person running the app: no shell on Windows, and a shell's full path elsewhere", () => {
      const own: string | null = ShellLocator.readUserShell();

      if (process.platform === "win32")
        assert.equal(own, null);
      else
        assert.match(own ?? "no shell", /^\/\S+$/u);
    });

    it("passes on any other failure of the read", () => {
      const failure: TypeError = new TypeError("broken");
      userShell.mockImplementation(() => {
        throw failure;
      });

      assert.throws(() => ShellLocator.readUserShell(), failure);
    });
  });
});
