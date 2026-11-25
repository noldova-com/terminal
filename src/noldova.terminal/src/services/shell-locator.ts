/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { userInfo } from "node:os";
import path from "node:path";

import type { IModuleLog } from "@noldova/desktop.runtime";
import { TerminalShellKind } from "@noldova/terminal.protocol";

import type { ICommandRunner } from "../interfaces/i-command-runner.ts";
import type { IFileSystemReader } from "../interfaces/i-file-system-reader.ts";
import { Shell } from "../models/shell.ts";
import { ShellCandidate } from "../models/shell-candidate.ts";
import type { VisualStudioInstallation } from "../models/visual-studio-installation.ts";
import { WslLauncher } from "../models/wsl-launcher.ts";
import { Resources } from "../resources.ts";
import { FailureText } from "./failure-text.ts";
import { VisualStudioReader } from "./visual-studio.reader.ts";
import { WslDistributionReader } from "./wsl-distribution.reader.ts";

export class ShellLocator {
  private readonly platform: string;
  private readonly architecture: string;
  private readonly environment: Readonly<Record<string, string | undefined>>;
  private readonly userShell: string | null;
  private readonly fileSystem: IFileSystemReader;
  private readonly log: IModuleLog;
  private readonly wsl: WslLauncher | null;
  private readonly visualStudioReader: VisualStudioReader;
  private distributions: Promise<readonly string[]> | null = null;
  private installations: Promise<readonly VisualStudioInstallation[]> | null = null;

  public constructor(platform: string, architecture: string, environment: Readonly<Record<string, string | undefined>>, userShell: string | null,
    fileSystem: IFileSystemReader, runner: ICommandRunner, log: IModuleLog) {
    const systemRoot: string | undefined = environment[Resources.systemRootVariable];
    this.platform = platform;
    this.architecture = architecture;
    this.environment = environment;
    this.userShell = userShell;
    this.fileSystem = fileSystem;
    this.log = log;
    this.wsl = Object.isUndefined(systemRoot) || systemRoot.length === 0
      ? null
      : new WslLauncher(path.win32.join(systemRoot, ...Resources.wslPath), new WslDistributionReader(runner, systemRoot));
    this.visualStudioReader = new VisualStudioReader(runner, fileSystem, environment[Resources.programFilesX86Variable]);
  }

  public static readUserShell(): string | null {
    try {
      const shell: string | null = userInfo().shell;
      return Object.isNull(shell) || shell.trim().length === 0 ? null : shell;
    }
    catch (error: unknown) {
      if (error instanceof Error && "code" in error && error.code === Resources.systemErrorCode)
        return null;
      throw error;
    }
  }

  public async locateAsync(): Promise<readonly Shell[]> {
    if (this.platform !== Resources.windowsPlatform)
      return this.locateOnUnixAsync();
    const installed: readonly Shell[] = await this.locateOnWindowsAsync();
    return [...installed, ...await this.locateListedAsync(installed)];
  }

  public async findAsync(shellId: string | null): Promise<Shell | undefined> {
    const isMatch = (shell: Shell): boolean => Object.isNull(shellId) ? shell.isDefault : shell.id === shellId;
    if (this.platform !== Resources.windowsPlatform)
      return (await this.locateOnUnixAsync()).find(isMatch);
    const installed: readonly Shell[] = await this.locateOnWindowsAsync();
    return installed.find(isMatch) ?? (Object.isNull(shellId) ? undefined : (await this.locateListedAsync(installed)).find(isMatch));
  }

  public async findKindAsync(kinds: readonly TerminalShellKind[]): Promise<Shell | undefined> {
    const isMatch = (shell: Shell): boolean => kinds.includes(shell.kind);
    if (this.platform !== Resources.windowsPlatform)
      return (await this.locateOnUnixAsync()).find(isMatch);
    const installed: readonly Shell[] = await this.locateOnWindowsAsync();
    return installed.find(isMatch) ?? (await this.locateListedAsync(installed)).find(isMatch);
  }

  private async locateOnWindowsAsync(): Promise<readonly Shell[]> {
    const programFiles: string | undefined = this.environment[Resources.programFilesVariable];
    const localAppData: string | undefined = this.environment[Resources.localAppDataVariable];
    const systemRoot: string | undefined = this.environment[Resources.systemRootVariable];
    const searchPath: readonly string[] = (this.environment[Resources.pathVariable] ?? "").split(path.win32.delimiter).filter(t => path.win32.isAbsolute(t));
    const gitFolders: readonly string[] = [
      ...ShellLocator.joinIfSet(programFiles, Resources.gitFolder),
      ...ShellLocator.joinIfSet(this.environment[Resources.programFilesX86Variable], Resources.gitFolder),
      ...ShellLocator.joinIfSet(localAppData, Resources.gitUserFolder),
      ...await this.findGitOnSearchPathAsync(searchPath)
    ];
    const candidates: readonly ShellCandidate[] = [
      new ShellCandidate(Resources.pwshId, Resources.pwshName, TerminalShellKind.PowerShell, [
        ...ShellLocator.joinIfSet(programFiles, [...Resources.pwshFolder, Resources.pwshFile]),
        ...searchPath.map(t => path.win32.join(t, Resources.pwshFile)),
        ...ShellLocator.joinIfSet(localAppData, [...Resources.appAliasFolder, Resources.pwshFile])
      ], []),
      new ShellCandidate(Resources.windowsPowerShellId, Resources.windowsPowerShellName, TerminalShellKind.PowerShell,
        ShellLocator.joinIfSet(systemRoot, Resources.windowsPowerShellPath), []),
      new ShellCandidate(Resources.cmdId, Resources.cmdName, TerminalShellKind.CommandPrompt, ShellLocator.joinIfSet(systemRoot, Resources.cmdPath), []),
      new ShellCandidate(Resources.gitBashId, Resources.gitBashName, TerminalShellKind.Bash, gitFolders.map(t => path.win32.join(t, ...Resources.gitBashFile)),
        Resources.gitBashArguments)
    ];
    const shells: Shell[] = [];
    for (const candidate of candidates) {
      const file: string | null = await this.findFileAsync(candidate.files);
      if (!Object.isNull(file))
        shells.push(new Shell(candidate.id, candidate.name, candidate.kind, file, candidate.args, shells.length === 0));
    }
    return shells;
  }

  private async locateOnUnixAsync(): Promise<readonly Shell[]> {
    const listed: readonly string[] = (await this.fileSystem.readTextOrNullAsync(Resources.shellsFile) ?? "")
      .split(Resources.lineFeed)
      .map(t => t.trim())
      .filter(t => t.startsWith(Resources.posixRoot) && !Resources.nonShellNames.includes(path.posix.basename(t)));
    const preferred: string | undefined = this.userShell ?? this.environment[Resources.shellVariable];
    const files: readonly string[] = Object.isUndefined(preferred) ? listed : [preferred, ...listed];
    const args: readonly string[] = [Resources.loginArgument];
    const shells: Shell[] = [];
    for (const file of files) {
      const id: string = path.posix.basename(file);
      if (id.length > 0 && !shells.some(t => t.id === id) && await this.fileSystem.isFileAsync(file))
        shells.push(new Shell(id, id, Resources.unixShellKinds.get(id) ?? TerminalShellKind.Other, file, args, shells.length === 0));
    }
    return shells;
  }

  private async locateListedAsync(installed: readonly Shell[]): Promise<readonly Shell[]> {
    const [wslShells, installations] = await Promise.all([this.locateWslShellsAsync(), this.readInstallationsAsync()]);
    const commandPrompt: Shell | undefined = installed.find(t => t.id === Resources.cmdId);
    const powerShell: Shell | undefined = installed.find(t => t.id === Resources.pwshId) ?? installed.find(t => t.id === Resources.windowsPowerShellId);
    const shells: Shell[] = [...wslShells];
    for (const installation of installations)
      shells.push(...await this.locateDeveloperShellsAsync(installation, commandPrompt, powerShell));
    return shells;
  }

  private async locateDeveloperShellsAsync(installation: VisualStudioInstallation, commandPrompt: Shell | undefined, powerShell: Shell | undefined):
    Promise<readonly Shell[]> {
    const tools: string = path.win32.join(installation.path, ...Resources.developerToolsPath);
    const script: string = path.win32.join(tools, Resources.developerCommandScript);
    const module: string = path.win32.join(tools, Resources.developerShellModule);
    const architecture: string = Resources.developerArchitectures.get(this.architecture) ?? this.architecture;
    const id: string = Resources.developerIdPrefix + installation.instanceId;
    const shells: Shell[] = [];
    if (!Object.isUndefined(commandPrompt) && await this.fileSystem.isFileAsync(script))
      shells.push(new Shell(id + Resources.developerCommandSuffix, Resources.formatDeveloperCommandPromptName(installation.name), TerminalShellKind.CommandPrompt,
        commandPrompt.file, [Resources.keepOpenArgument, script, Resources.noStartFolderArgument, ...Resources.formatDeveloperArchitectureArguments(architecture)],
        false));
    if (!Object.isUndefined(powerShell) && await this.fileSystem.isFileAsync(module))
      shells.push(new Shell(id + Resources.developerPowerShellSuffix, Resources.formatDeveloperPowerShellName(installation.name), TerminalShellKind.PowerShell,
        powerShell.file, [], false, Resources.formatDeveloperPowerShellCommand(module, installation.path, architecture)));
    return shells;
  }

  private async locateWslShellsAsync(): Promise<readonly Shell[]> {
    const wsl: WslLauncher | null = this.wsl;
    if (Object.isNull(wsl))
      return [];
    this.distributions ??= wsl.reader.readAsync().catch((error: unknown) => {
      this.distributions = null;
      this.log.write(FailureText.read(error));
      return [];
    });
    return (await this.distributions)
      .filter(t => !t.toLowerCase().startsWith(Resources.wslDockerPrefix))
      .map(t => new Shell(Resources.wslIdPrefix + t, t, TerminalShellKind.Wsl, wsl.file, [Resources.wslDistributionArgument, t], false));
  }

  private readInstallationsAsync(): Promise<readonly VisualStudioInstallation[]> {
    this.installations ??= this.visualStudioReader.readAsync().catch((error: unknown) => {
      this.installations = null;
      this.log.write(FailureText.read(error));
      return [];
    });
    return this.installations;
  }

  private async findFileAsync(files: readonly string[]): Promise<string | null> {
    for (const file of files) {
      if (await this.fileSystem.isProgramAsync(file))
        return file;
    }
    return null;
  }

  private async findGitOnSearchPathAsync(searchPath: readonly string[]): Promise<readonly string[]> {
    const folders: string[] = [];
    for (const folder of searchPath) {
      if (path.win32.basename(folder).toLowerCase() === Resources.gitCommandFolder && await this.fileSystem.isProgramAsync(path.win32.join(folder, Resources.gitExecutableFile)))
        folders.push(path.win32.dirname(folder));
    }
    return folders;
  }

  private static joinIfSet(folder: string | undefined, names: readonly string[]): readonly string[] {
    return Object.isUndefined(folder) || folder.length === 0 ? [] : [path.win32.join(folder, ...names)];
  }
}
