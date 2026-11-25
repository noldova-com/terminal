/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import assert from "node:assert/strict";
import path from "node:path";

import { QualifiedName, SettingChange, SettingKey } from "@noldova/desktop.protocol";
import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
import { FakeModuleLog, FakeModuleSettings } from "@noldova/desktop.runtime/testing";
import { Resources as ProtocolResources, TerminalShellKind } from "@noldova/terminal.protocol";
import { describe, it } from "vitest";

import { Shell } from "../../src/models/shell.ts";
import { ShellLaunch } from "../../src/models/shell-launch.ts";
import { Resources } from "../../src/resources.ts";
import { ShellIntegration } from "../../src/services/shell-integration.ts";
import { FakeFileSystemWriter } from "../fixtures/fake-file-system-writer.fixture.ts";
import { FakeFolderAccess } from "../fixtures/fake-folder-access.fixture.ts";
import { FakePtyProcess } from "../fixtures/fake-pty-process.fixture.ts";

const FOLDER: string = path.join("/tmp", "noldova-terminal-1");
const NONCE: string = "0123456789abcdef0123456789abcdef";
const NONCE_FILE: RegExp = /^nonce-[\da-f]{32}$/u;
const CMD: string = "C:\\Windows\\System32\\cmd.exe";

class RemovalWriter extends FakeFileSystemWriter {
  public readonly fileRemoved: PromiseWithResolvers<void> = Promise.withResolvers<void>();

  public override async removeFileAsync(path: string): Promise<void> {
    await super.removeFileAsync(path);
    this.fileRemoved.resolve();
  }
}

class IntegrationFixture {
  public readonly writer: RemovalWriter = new RemovalWriter();
  public readonly log: FakeModuleLog = new FakeModuleLog();
  public readonly settings: FakeModuleSettings = new FakeModuleSettings();
  public readonly access: FakeFolderAccess = new FakeFolderAccess(this.writer);
  public readonly integration: ShellIntegration;

  public constructor(hasAccess: boolean = false, platform: string = "linux") {
    this.integration = new ShellIntegration(this.writer, "/tmp", this.log, hasAccess ? this.access : null, this.settings, platform);
  }

  public get messages(): readonly unknown[] {
    return this.log.callsOf("write").map(t => t[0]);
  }

  public prepareAsync(file: string, args: readonly string[] = [], environment: Readonly<Record<string, string | undefined>> = {}): Promise<ShellLaunch> {
    return this.integration.prepareAsync(new Shell("id", "Shell", TerminalShellKind.Other, file, args, false), NONCE, environment);
  }
}

function changed(value: boolean | null): SettingChange {
  return new SettingChange(new SettingKey(QualifiedName.parse(ProtocolResources.suggestionsSetting)), value, !Object.isNull(value));
}

function decode(encoded: string | undefined): string {
  return Buffer.from(encoded ?? "", "base64").toString("utf16le");
}

function assertNonceFile(fixture: IntegrationFixture, launch: ShellLaunch, variable: string | undefined): string {
  const nonceFile: string = launch.nonceFile ?? "";
  assert.equal(path.dirname(nonceFile), FOLDER);
  assert.match(path.basename(nonceFile), NONCE_FILE);
  assert.equal(fixture.writer.files.get(nonceFile), `${NONCE}\n`);
  assert.equal(variable, nonceFile);
  assert.equal([...launch.args, ...Object.values(launch.environment)].some(t => t.includes(NONCE)), false);
  return nonceFile;
}

describe("ShellIntegration", () => {
  it("starts bash with its init file and the path of its nonce file, and marks a login shell", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture();
    const script: string = `${FOLDER.replaceAll("\\", "/")}/noldova.bash`;

    const bash: ShellLaunch = await fixture.prepareAsync("/bin/bash");
    const gitBash: ShellLaunch = await fixture.prepareAsync("C:\\Program Files\\Git\\bin\\BASH.EXE", ["--login", "-i"]);

    assert.deepEqual([bash.file, bash.args, bash.nonce], ["/bin/bash", ["--init-file", script, "-i"], NONCE]);
    assert.deepEqual(Object.keys(bash.environment), ["NOLDOVA_TERMINAL_NONCE_FILE"]);
    assertNonceFile(fixture, bash, bash.environment["NOLDOVA_TERMINAL_NONCE_FILE"]?.replaceAll("/", path.sep));
    assert.deepEqual([gitBash.args, gitBash.environment["NOLDOVA_TERMINAL_LOGIN"]], [["--init-file", script, "-i"], "1"]);
    assert.equal(gitBash.environment["NOLDOVA_TERMINAL_NONCE_FILE"], gitBash.nonceFile?.replaceAll("\\", "/"));
    assert.equal(fixture.writer.folders, 1);
    assert.deepEqual([...fixture.writer.files].map(t => t[0]).slice(0, 5), [
      path.join(FOLDER, "noldova.bash"), path.join(FOLDER, ".zshenv"), path.join(FOLDER, ".zprofile"), path.join(FOLDER, ".zshrc"),
      path.join(FOLDER, ".zlogin")
    ]);
    assert.deepEqual([...fixture.writer.files].slice(0, 5).map(t => t[1]),
      [Resources.shellIntegrationBashScript, Resources.shellIntegrationZshEnvironment, Resources.shellIntegrationZshProfile, Resources.shellIntegrationZshInteractive, Resources.shellIntegrationZshLogin]);
  });

  it("gives each shell a nonce file of its own, whose name says nothing of the shell or its nonce", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture();

    const first: ShellLaunch = await fixture.prepareAsync("/bin/bash");
    const second: ShellLaunch = await fixture.prepareAsync("/bin/bash");

    assert.notEqual(first.nonceFile, second.nonceFile);
    assert.equal([first.nonceFile, second.nonceFile].some(t => t?.includes(NONCE) === true), false);
  });

  it("starts zsh from its own startup folder, and keeps the person's folder", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture();

    const login: ShellLaunch = await fixture.prepareAsync("/bin/zsh", ["-l"]);
    const configured: ShellLaunch = await fixture.prepareAsync("/bin/zsh", [], { ZDOTDIR: "/home/a/.config/zsh" });

    assert.deepEqual([login.args, login.environment["ZDOTDIR"], login.nonce], [["-l"], FOLDER, NONCE]);
    assertNonceFile(fixture, login, login.environment["NOLDOVA_TERMINAL_NONCE_FILE"]);
    assert.deepEqual(configured.environment, {
      NOLDOVA_TERMINAL_NONCE_FILE: configured.nonceFile, ZDOTDIR: FOLDER, NOLDOVA_TERMINAL_ZDOTDIR: "/home/a/.config/zsh"
    });
  });

  it("starts PowerShell without its profiles, which its encoded command runs after reading the nonce", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture();
    const pwsh: ShellLaunch = await fixture.prepareAsync("C:\\Program Files\\PowerShell\\7\\pwsh.exe");
    const windowsPowerShell: ShellLaunch = await fixture.prepareAsync("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", ["-NoLogo"]);

    assert.deepEqual(pwsh.args.slice(0, 3), ["-NoProfile", "-NoExit", "-EncodedCommand"]);
    assert.equal(decode(pwsh.args[3]), `${Resources.shellIntegrationPowerShellNonce}\n${Resources.shellIntegrationPowerShellNote}\n${Resources.shellIntegrationPowerShellProfiles}\n${Resources.shellIntegrationPowerShellScript}`);
    assert.deepEqual(windowsPowerShell.args.slice(0, 4), ["-NoLogo", "-NoProfile", "-NoExit", "-EncodedCommand"]);
    assert.deepEqual(Object.keys(pwsh.environment), ["NOLDOVA_TERMINAL_NONCE_FILE"]);
    assertNonceFile(fixture, pwsh, pwsh.environment["NOLDOVA_TERMINAL_NONCE_FILE"]);
    assert.equal(pwsh.nonce, NONCE);
  });

  it("starts a login pwsh on macOS as pwsh's own login does, through zsh as a login sh with pwsh's login check marked done, passing every argument on", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture(false, "darwin");
    const file: string = "/Users/a b/Power Shell/pwsh";
    const odd: readonly string[] = ["-WorkingDirectory", "a b", "it's \"x\"", "$HOME", "-$x", ""];

    const login: ShellLaunch = await fixture.prepareAsync(file, ["-l", ...odd]);
    const named: ShellLaunch = await fixture.prepareAsync("pwsh", ["-Login"]);
    const prefix: ShellLaunch = await fixture.prepareAsync("pwsh", ["-LO"]);

    assert.deepEqual([login.file, login.args.slice(0, 13)],
      ["/bin/zsh", ["--emulate", "sh", "-l", "-c", "exec \"$0\" \"$@\"", file, ...odd, "-NoProfile"]]);
    assert.deepEqual(login.args.slice(13, 15), ["-NoExit", "-EncodedCommand"]);
    assert.deepEqual([login.environment["__PWSH_LOGIN_CHECKED"], login.nonce], ["1", NONCE]);
    assertNonceFile(fixture, login, login.environment["NOLDOVA_TERMINAL_NONCE_FILE"]);
    assert.deepEqual([named.file, named.args.slice(5, 7), prefix.file, prefix.args.slice(5, 7)], ["/bin/zsh", ["pwsh", "-NoProfile"], "/bin/zsh", ["pwsh", "-NoProfile"]]);
  });

  it("starts pwsh as itself on macOS without a leading login parameter, a login pwsh as itself on Linux and Windows, and other shells on macOS as before",
    async () => {
      const mac: IntegrationFixture = new IntegrationFixture(false, "darwin");
      const linux: IntegrationFixture = new IntegrationFixture(false, "linux");
      const windows: IntegrationFixture = new IntegrationFixture(false, "win32");

      const starts: readonly ShellLaunch[] = [
        await mac.prepareAsync("pwsh"),
        await mac.prepareAsync("pwsh", ["-NoLogo", "-l"]),
        await mac.prepareAsync("pwsh", ["--login"]),
        await mac.prepareAsync("pwsh", ["-"]),
        await mac.prepareAsync("pwsh", ["-lx"]),
        await linux.prepareAsync("/usr/bin/pwsh", ["-l"]),
        await windows.prepareAsync("C:\\Program Files\\PowerShell\\7\\pwsh.exe", ["-l"])
      ];
      const zsh: ShellLaunch = await mac.prepareAsync("/bin/zsh", ["-l"]);
      const bash: ShellLaunch = await mac.prepareAsync("/bin/bash", ["-l"]);
      mac.writer.writeFailure = new Error("disk full");
      mac.writer.writeFailurePath = "nonce-";
      const plain: ShellLaunch = await mac.prepareAsync("pwsh");

      assert.deepEqual(starts.map(t => [t.file, t.args[0], "__PWSH_LOGIN_CHECKED" in t.environment]), [
        ["pwsh", "-NoProfile", false], ["pwsh", "-NoLogo", false], ["pwsh", "--login", false], ["pwsh", "-", false], ["pwsh", "-lx", false],
        ["/usr/bin/pwsh", "-l", false], ["C:\\Program Files\\PowerShell\\7\\pwsh.exe", "-l", false]
      ]);
      assert.deepEqual([zsh.file, zsh.args, bash.file, bash.args[0]], ["/bin/zsh", ["-l"], "/bin/bash", "--init-file"]);
      assert.deepEqual(plain, new ShellLaunch("pwsh", [], {}, null));
    });

  it("reads a PowerShell's nonce, then runs its profiles, its start command and its script, in the same encoded command", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture();
    const shell: Shell = new Shell("vs-a1-powershell", "Developer PowerShell", TerminalShellKind.PowerShell, "C:\\Program Files\\PowerShell\\7\\pwsh.exe", [], false,
      "& { Enter-VsDevShell }");

    const launch: ShellLaunch = await fixture.integration.prepareAsync(shell, NONCE, {});

    assert.deepEqual(launch.args.slice(0, 3), ["-NoProfile", "-NoExit", "-EncodedCommand"]);
    assert.equal(decode(launch.args[3]), `${Resources.shellIntegrationPowerShellNonce}\n${Resources.shellIntegrationPowerShellNote}\n${Resources.shellIntegrationPowerShellProfiles}\n& { Enter-VsDevShell }\n${Resources.shellIntegrationPowerShellScript}`);
    assert.equal(launch.args.length, 4);
  });

  it("leaves PSReadLine's own predictions to the person's profile whatever the Suggest earlier commands setting, so the window's suggestion gives way to them", async () => {
    const writer: FakeFileSystemWriter = new FakeFileSystemWriter();
    const settings: FakeModuleSettings = new FakeModuleSettings();
    const integration: ShellIntegration = new ShellIntegration(writer, "/tmp", new FakeModuleLog(), null, settings, "win32");
    const shell: Shell = new Shell("vs-a1-powershell", "Developer PowerShell", TerminalShellKind.PowerShell, "C:\\Program Files\\PowerShell\\7\\pwsh.exe", [], false,
      "& { Enter-VsDevShell }");

    settings.answer("read", () => true);
    const suggesting: ShellLaunch = await integration.prepareAsync(shell, NONCE, {});
    settings.answer("read", () => false);
    const plain: ShellLaunch = await integration.prepareAsync(shell, NONCE, {});

    const expected: string = `${Resources.shellIntegrationPowerShellNonce}\n${Resources.shellIntegrationPowerShellNote}\n${Resources.shellIntegrationPowerShellProfiles}\n& { Enter-VsDevShell }\n${Resources.shellIntegrationPowerShellScript}`;
    assert.deepEqual([decode(suggesting.args[3]), decode(plain.args[3])], [expected, expected]);
    assert.equal(expected.includes("PredictionSource"), false);
  });

  it("makes .NET's shared memory folder in the runtime folder, for its owner alone, before the first PowerShell of each runtime folder on Linux", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture();

    await fixture.prepareAsync("/usr/bin/pwsh", [], { XDG_RUNTIME_DIR: "/run/user/1000" });
    await fixture.prepareAsync("/opt/microsoft/powershell/7/pwsh", ["-NoLogo"], { XDG_RUNTIME_DIR: "/run/user/1000" });
    await fixture.prepareAsync("/usr/bin/pwsh", [], { XDG_RUNTIME_DIR: "/run/user/1001/" });

    assert.deepEqual(fixture.writer.missingFolders, [["/run/user/1000/.dotnet", 0o700], ["/run/user/1000/.dotnet/shm", 0o700],
      ["/run/user/1001/.dotnet", 0o700], ["/run/user/1001/.dotnet/shm", 0o700]]);
    assert.deepEqual(fixture.messages, []);
  });

  it("makes the shared memory folder for a PowerShell on Linux with an absolute runtime folder alone, not for other shells, without one, or on Windows and macOS", async () => {
    const linux: IntegrationFixture = new IntegrationFixture();
    const others: IntegrationFixture[] = [new IntegrationFixture(false, "win32"), new IntegrationFixture(false, "darwin")];

    for (const file of ["/bin/bash", "/bin/zsh", "/usr/bin/fish"])
      await linux.prepareAsync(file, [], { XDG_RUNTIME_DIR: "/run/user/1000" });
    for (const environment of [{}, { XDG_RUNTIME_DIR: "" }, { XDG_RUNTIME_DIR: undefined }, { XDG_RUNTIME_DIR: "run/user/1000" }])
      await linux.prepareAsync("/usr/bin/pwsh", [], environment);
    for (const fixture of others)
      await fixture.prepareAsync("pwsh", [], { XDG_RUNTIME_DIR: "/run/user/1000" });
    await linux.prepareAsync("/usr/bin/pwsh", [], { XDG_RUNTIME_DIR: "/run/user/1002" });

    assert.deepEqual([linux, ...others].map(t => t.writer.missingFolders), [[["/run/user/1002/.dotnet", 0o700], ["/run/user/1002/.dotnet/shm", 0o700]], [], []]);
  });

  it("starts PowerShell with its integration when the shared memory folder can't be made, saying why in the log once for the folder", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture();
    fixture.writer.missingFolderFailure = new Error("EACCES: permission denied, mkdir '/run/user/1000/.dotnet'");

    const first: ShellLaunch = await fixture.prepareAsync("/usr/bin/pwsh", [], { XDG_RUNTIME_DIR: "/run/user/1000" });
    const second: ShellLaunch = await fixture.prepareAsync("/usr/bin/pwsh", [], { XDG_RUNTIME_DIR: "/run/user/1000" });

    assert.deepEqual([first.nonce, second.nonce], [NONCE, NONCE]);
    assert.equal(fixture.writer.missingFolders.length, 1);
    assert.deepEqual(fixture.messages, [Resources.formatDotnetSharedMemoryFolderFailed("/run/user/1000/.dotnet/shm",
      "EACCES: permission denied, mkdir '/run/user/1000/.dotnet'")]);
  });

  it("suggests earlier commands with the setting unset or on, and while the setting can't be read, saying why in the log", () => {
    const fixture: IntegrationFixture = new IntegrationFixture();
    const answers: boolean[] = [];
    for (const read of [(): null => null, (): boolean => true, (): boolean => false, (): never => {
      throw new Error("The settings file is locked.");
    }, (): never => {
      throw "busy";
    }]) {
      fixture.settings.answer("read", read);
      answers.push(fixture.integration.isSuggesting());
    }

    assert.deepEqual(answers, [true, true, false, true, true]);
    assert.deepEqual(fixture.settings.callsOf("read"), Array.from({ length: 5 }, () => [ProtocolResources.suggestionsSetting]));
    assert.deepEqual(fixture.messages, [Resources.formatSuggestionsUnread("The settings file is locked."), Resources.formatSuggestionsUnread("busy")]);
  });

  it("tells whether the terminal suggests earlier commands after each change of the setting, and logs a subscription that fails", () => {
    const fixture: IntegrationFixture = new IntegrationFixture();
    const refusing: FakeModuleSettings = new FakeModuleSettings();
    refusing.beStrict();
    const changes: boolean[] = [];
    fixture.integration.onSuggestingChanged(t => changes.push(t));

    fixture.settings.raiseChanged(ProtocolResources.suggestionsSetting, changed(false));
    fixture.settings.raiseChanged(ProtocolResources.suggestionsSetting, changed(null));
    new ShellIntegration(new FakeFileSystemWriter(), "/tmp", fixture.log, null, refusing, "linux").onSuggestingChanged(t => changes.push(t));

    assert.deepEqual(changes, [false, true]);
    assert.deepEqual(fixture.settings.activeCallsOf("onChanged").map(t => t[0]), [ProtocolResources.suggestionsSetting]);
    assert.deepEqual(fixture.messages, [Resources.formatSuggestionsUnwatched(new UnansweredCallException("onChanged").message)]);
  });

  it("hands a note to a shell with an integration as a variable, outside its script", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture();
    const note: string = "\u001b[2;3mThe folder C:\\a `$(b)' \"c\" does not exist.\u001b[0m\r\n";
    const prepareAsync: (file: string) => Promise<ShellLaunch> = file =>
      fixture.integration.prepareAsync(new Shell("id", "Shell", TerminalShellKind.Other, file, [], false), NONCE, {}, note);

    const launches: ShellLaunch[] = [await prepareAsync("C:\\Program Files\\PowerShell\\7\\pwsh.exe"),
      await prepareAsync("C:\\Program Files\\Git\\bin\\bash.exe"), await prepareAsync("/bin/zsh")];

    assert.deepEqual(launches.map(t => [t.environment["NOLDOVA_TERMINAL_NOTE"], t.printsNote]), [[note, true], [note, true], [note, true]]);
    assert.equal(launches.some(t => [...t.args].some(a => a.includes("does not exist") || decode(a).includes("does not exist"))), false);
  });

  it("has a Command Prompt echo a note from a variable through a second one with delayed expansion, before what its /k runs", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture();
    const note: string = "\u001b[2;3mThe folder C:\\a & b %c% !d! ^e does not exist.\u001b[0m\r\n";
    const prepareAsync: (args: readonly string[]) => Promise<ShellLaunch> = args =>
      fixture.integration.prepareAsync(new Shell("id", "Shell", TerminalShellKind.CommandPrompt, CMD, args, false), NONCE, {}, note);

    const plain: ShellLaunch = await prepareAsync([]);
    const developer: ShellLaunch = await prepareAsync(["/K", "C:\\Program Files\\VS\\VsDevCmd.bat", "-startdir=none", "-arch=amd64"]);

    const echo: string = `/s /k ""${CMD}" /d /v:on /s /c "echo(^!NOLDOVA_TERMINAL_NOTE^!"& set "NOLDOVA_TERMINAL_NOTE="`;
    assert.deepEqual(plain, new ShellLaunch(CMD, `${echo}"`, { NOLDOVA_TERMINAL_NOTE: note.slice(0, -2) }, null, null, true));
    assert.deepEqual(developer, new ShellLaunch(CMD, `${echo} & "C:\\Program Files\\VS\\VsDevCmd.bat" -startdir=none -arch=amd64"`,
      { NOLDOVA_TERMINAL_NOTE: note.slice(0, -2) }, null, null, true));
    assert.equal(fixture.writer.folders, 0);
  });

  it("leaves a note to the runtime for a Command Prompt started with other arguments than /k, and starts one without a note as it is",
    async () => {
      const fixture: IntegrationFixture = new IntegrationFixture();
      const shell: (args: readonly string[]) => Shell = args => new Shell("id", "Shell", TerminalShellKind.CommandPrompt, CMD, args, false);

      assert.deepEqual(await fixture.integration.prepareAsync(shell(["/q"]), NONCE, {}, "\u001b[2;3mA note.\u001b[0m\r\n"),
        new ShellLaunch(CMD, ["/q"], {}, null));
      assert.deepEqual(await fixture.integration.prepareAsync(shell(["/k", "start.bat"]), NONCE, {}),
        new ShellLaunch(CMD, ["/k", "start.bat"], {}, null));
    });

  it("leaves a note to the runtime when the integration's scripts cannot be written", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture();
    fixture.writer.failure = new Error("disk full");

    const launch: ShellLaunch = await fixture.integration.prepareAsync(new Shell("id", "Shell", TerminalShellKind.Other, "pwsh.exe", [], false), NONCE, {},
      "The folder a does not exist.\r\n");

    assert.deepEqual(launch, new ShellLaunch("pwsh.exe", [], {}, null));
  });

  it("starts other shells unchanged", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture();

    assert.deepEqual(await fixture.prepareAsync("C:\\Windows\\System32\\cmd.exe"), new ShellLaunch("C:\\Windows\\System32\\cmd.exe", [], {}, null));
    assert.deepEqual(await fixture.prepareAsync("/usr/bin/fish", ["-l"]), new ShellLaunch("/usr/bin/fish", ["-l"], {}, null));
    assert.equal(fixture.writer.folders, 0);
  });

  it("starts shells without integration while its scripts cannot be written, and tries again later", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture();
    fixture.writer.failure = new Error("disk full");

    assert.deepEqual(await fixture.prepareAsync("/bin/bash"), new ShellLaunch("/bin/bash", [], {}, null));
    fixture.writer.failure = "no access";
    assert.deepEqual(await fixture.prepareAsync("/bin/zsh"), new ShellLaunch("/bin/zsh", [], {}, null));
    assert.deepEqual(await fixture.prepareAsync("pwsh.exe", ["-NoLogo"]), new ShellLaunch("pwsh.exe", ["-NoLogo"], {}, null));
    fixture.writer.failure = null;
    assert.equal((await fixture.prepareAsync("/bin/zsh")).nonce, NONCE);

    assert.deepEqual(fixture.messages, [
      "Shells start without the module's shell integration, whose folder could not be made private or whose scripts could not be written: disk full",
      "Shells start without the module's shell integration, whose folder could not be made private or whose scripts could not be written: no access",
      "Shells start without the module's shell integration, whose folder could not be made private or whose scripts could not be written: no access"
    ]);
  });

  it("makes its folder private before it writes anything in it, once for all shells", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture(true);

    const bash: ShellLaunch = await fixture.prepareAsync("/bin/bash");
    await fixture.prepareAsync("pwsh.exe");

    assert.equal(bash.nonce, NONCE);
    assert.deepEqual(fixture.access.restricted, [[FOLDER, 0]]);
    assert.equal(fixture.writer.files.size, 7);
  });

  it("starts shells without integration, and removes its folder, while the folder can't be made private, and tries again later", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture(true);
    fixture.access.failure = new Error("icacls.exe exited with 5.");

    const plain: ShellLaunch = await fixture.prepareAsync("/bin/bash");
    fixture.access.failure = null;
    const integrated: ShellLaunch = await fixture.prepareAsync("/bin/bash");

    assert.deepEqual(plain, new ShellLaunch("/bin/bash", [], {}, null));
    assert.deepEqual(fixture.writer.removed, [FOLDER]);
    assert.deepEqual(fixture.access.restricted, [[FOLDER, 0], [path.join("/tmp", "noldova-terminal-2"), 0]]);
    assert.equal(path.dirname(integrated.nonceFile ?? ""), path.join("/tmp", "noldova-terminal-2"));
    assert.deepEqual(fixture.messages, [
      "Shells start without the module's shell integration, whose folder could not be made private or whose scripts could not be written: icacls.exe exited with 5."
    ]);
  });

  it("starts shells without integration, and removes its folder, when one of its scripts can't be written, and tries again later", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture(true);
    fixture.writer.writeFailure = new Error("ENOSPC: no space left on device");
    fixture.writer.writeFailurePath = ".zprofile";

    const plain: ShellLaunch = await fixture.prepareAsync("/bin/bash");
    fixture.writer.writeFailure = null;
    const integrated: ShellLaunch = await fixture.prepareAsync("/bin/bash");

    assert.deepEqual(plain, new ShellLaunch("/bin/bash", [], {}, null));
    assert.deepEqual(fixture.writer.removed, [FOLDER]);
    assert.equal(path.dirname(integrated.nonceFile ?? ""), path.join("/tmp", "noldova-terminal-2"));
    assert.deepEqual(fixture.messages, [
      "Shells start without the module's shell integration, whose folder could not be made private or whose scripts could not be written: ENOSPC: no space left on device"
    ]);
  });

  it("logs why the folder couldn't be made private, and why it couldn't remove the folder either", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture(true);
    fixture.access.failure = new Error("icacls.exe exited with 5.");
    fixture.writer.removalFailure = new Error("EBUSY");

    assert.deepEqual(await fixture.prepareAsync("/bin/bash"), new ShellLaunch("/bin/bash", [], {}, null));

    assert.deepEqual(fixture.messages, [
      "The module's shell integration scripts could not be removed: EBUSY",
      "Shells start without the module's shell integration, whose folder could not be made private or whose scripts could not be written: icacls.exe exited with 5."
    ]);
  });

  it("starts a shell without integration when its nonce file cannot be written, and keeps a PowerShell's profiles and start command", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture();
    const shell: Shell = new Shell("vs-a1-powershell", "Developer PowerShell", TerminalShellKind.PowerShell, "pwsh.exe", ["-NoLogo"], false,
      "& { Enter-VsDevShell }");
    fixture.writer.writeFailure = new Error("disk full");
    fixture.writer.writeFailurePath = "nonce-";

    assert.deepEqual(await fixture.prepareAsync("/bin/bash"), new ShellLaunch("/bin/bash", [], {}, null));
    const launch: ShellLaunch = await fixture.integration.prepareAsync(shell, NONCE, {});
    fixture.writer.writeFailure = "no access";
    assert.deepEqual(await fixture.prepareAsync("/bin/zsh"), new ShellLaunch("/bin/zsh", [], {}, null));

    assert.deepEqual([launch.args.slice(0, 3), decode(launch.args[3]), launch.environment, launch.nonce],
      [["-NoLogo", "-NoExit", "-EncodedCommand"], "& { Enter-VsDevShell }", {}, null]);
    assert.deepEqual(fixture.messages, [
      "A shell starts without the module's shell integration, whose nonce file could not be written: disk full",
      "A shell starts without the module's shell integration, whose nonce file could not be written: disk full",
      "A shell starts without the module's shell integration, whose nonce file could not be written: no access"
    ]);
  });

  it("removes a shell's nonce file once its output carries the nonce, and only once", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture();
    const launch: ShellLaunch = await fixture.prepareAsync("/bin/bash");
    const process: FakePtyProcess = new FakePtyProcess();
    fixture.integration.watch(process, launch);

    process.emitData("$ ");
    assert.deepEqual(fixture.writer.removedFiles, []);
    process.emitData(`\u001b]6973;A;${NONCE}\u0007`);
    process.emitData(`\u001b]6973;B;${NONCE}\u0007`);
    process.exit(0);

    await fixture.writer.fileRemoved.promise;
    assert.deepEqual(fixture.writer.removedFiles, [launch.nonceFile]);
  });

  it("removes the nonce file of a shell that exits before its first mark", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture();
    const launch: ShellLaunch = await fixture.prepareAsync("/bin/zsh");
    const process: FakePtyProcess = new FakePtyProcess();
    fixture.integration.watch(process, launch);

    process.emitData("zsh: no such file or directory\r\n");
    process.exit(127);
    process.emitData(`\u001b]6973;A;${NONCE}\u0007`);

    await fixture.writer.fileRemoved.promise;
    assert.deepEqual(fixture.writer.removedFiles, [launch.nonceFile]);
    assert.deepEqual(fixture.messages, []);
  });

  it("watches nothing for a shell without a nonce file", () => {
    const fixture: IntegrationFixture = new IntegrationFixture();
    const process: FakePtyProcess = new FakePtyProcess();

    fixture.integration.watch(process, new ShellLaunch("/usr/bin/fish", [], {}, null));
    fixture.integration.watch(process, new ShellLaunch("/bin/bash", [], {}, NONCE));
    process.emitData(`\u001b]6973;A;${NONCE}\u0007`);
    process.exit(0);

    assert.deepEqual(fixture.writer.removedFiles, []);
  });

  for (const failure of [new Error("busy"), "busy"])
    it(`logs a nonce file that cannot be removed, with ${Object.isString(failure) ? "a reason" : "an error"}`, async () => {
      const fixture: IntegrationFixture = new IntegrationFixture();
      const launch: ShellLaunch = await fixture.prepareAsync("/bin/bash");
      fixture.writer.fileRemovalFailure = failure;

      await fixture.integration.removeNonceFileAsync(launch.nonceFile);
      await fixture.integration.removeNonceFileAsync(null);

      assert.deepEqual(fixture.messages, ["A shell's nonce file could not be removed: busy"]);
    });

  it("removes its scripts' folder once when disposed", async () => {
    const fixture: IntegrationFixture = new IntegrationFixture();
    await fixture.integration.disposeAsync();
    await fixture.prepareAsync("/bin/bash");

    await fixture.integration.disposeAsync();
    await fixture.integration.disposeAsync();

    assert.deepEqual(fixture.writer.removed, [FOLDER]);
  });
});
