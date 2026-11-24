/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { randomBytes } from "node:crypto";
import path from "node:path";

import type { IModuleLog, IModuleSettings } from "@noldova/desktop.runtime";
import { Resources as ProtocolResources } from "@noldova/terminal.protocol";

import { ShellFamily } from "../enums/shell-family.ts";
import type { IDisposable } from "../interfaces/i-disposable.ts";
import type { IFileSystemWriter } from "../interfaces/i-file-system-writer.ts";
import type { IFolderAccess } from "../interfaces/i-folder-access.ts";
import type { IPtyProcess } from "../interfaces/i-pty-process.ts";
import type { Shell } from "../models/shell.ts";
import { ShellLaunch } from "../models/shell-launch.ts";
import { Resources } from "../resources.ts";
import { FailureText } from "./failure-text.ts";

export class ShellIntegration {
  private readonly writer: IFileSystemWriter;
  private readonly temporaryFolder: string;
  private readonly log: IModuleLog;
  private readonly access: IFolderAccess | null;
  private readonly settings: IModuleSettings;
  private readonly platform: string;
  private readonly sharedMemoryFolders: Map<string, Promise<void>> = new Map<string, Promise<void>>();
  private folder: Promise<string> | null = null;

  public constructor(writer: IFileSystemWriter, temporaryFolder: string, log: IModuleLog, access: IFolderAccess | null, settings: IModuleSettings,
    platform: string) {
    this.writer = writer;
    this.temporaryFolder = temporaryFolder;
    this.log = log;
    this.access = access;
    this.settings = settings;
    this.platform = platform;
  }

  public async prepareAsync(shell: Shell, nonce: string, environment: Readonly<Record<string, string | undefined>>,
    note: string | null = null): Promise<ShellLaunch> {
    const launch: ShellLaunch = await this.prepareShellAsync(shell, nonce, environment, note);
    return this.platform === Resources.macPlatform && ShellIntegration.toFamily(shell.file) === ShellFamily.PowerShell
      ? ShellIntegration.toPowerShellLoginLaunch(launch) : launch;
  }

  public watch(process: IPtyProcess, launch: ShellLaunch): void {
    const { nonce, nonceFile } = launch;
    if (Object.isNull(nonce) || Object.isNull(nonceFile))
      return;
    const remove = (): void => {
      data.dispose();
      exit.dispose();
      void this.removeNonceFileAsync(nonceFile);
    };
    const data: IDisposable = process.onData(t => {
      if (t.includes(nonce))
        remove();
    });
    const exit: IDisposable = process.onExit(() => remove());
  }

  public async removeNonceFileAsync(nonceFile: string | null): Promise<void> {
    if (Object.isNull(nonceFile))
      return;
    try {
      await this.writer.removeFileAsync(nonceFile);
    }
    catch (error: unknown) {
      this.log.write(Resources.formatNonceFileRemovalFailed(FailureText.read(error)));
    }
  }

  public async disposeAsync(): Promise<void> {
    const folder: Promise<string> | null = this.folder;
    this.folder = null;
    if (!Object.isNull(folder))
      await this.writer.removeFolderAsync(await folder);
  }

  public isSuggesting(): boolean {
    try {
      return this.settings.read(ProtocolResources.suggestionsSetting) !== false;
    }
    catch (error: unknown) {
      this.log.write(Resources.formatSuggestionsUnread(FailureText.read(error)));
      return true;
    }
  }

  public onSuggestingChanged(listener: (isSuggesting: boolean) => void): void {
    try {
      this.settings.onChanged(ProtocolResources.suggestionsSetting, t => listener(t.value !== false));
    }
    catch (error: unknown) {
      this.log.write(Resources.formatSuggestionsUnwatched(FailureText.read(error)));
    }
  }

  private async prepareShellAsync(shell: Shell, nonce: string, environment: Readonly<Record<string, string | undefined>>,
    note: string | null): Promise<ShellLaunch> {
    const family: ShellFamily = ShellIntegration.toFamily(shell.file);
    if (family === ShellFamily.CommandPrompt)
      return ShellIntegration.toCommandPromptLaunch(shell, note);
    if (family === ShellFamily.Other)
      return new ShellLaunch(shell.file, shell.args, {}, null);
    if (family === ShellFamily.PowerShell)
      await this.makeSharedMemoryFolderAsync(environment);
    const folder: string | null = await this.writeScriptsOrNullAsync();
    const nonceFile: string | null = Object.isNull(folder) ? null : await this.writeNonceOrNullAsync(folder, nonce);
    if (Object.isNull(folder) || Object.isNull(nonceFile))
      return ShellIntegration.toPlainLaunch(shell, family);
    const noteVariables: Readonly<Record<string, string>> = Object.isNull(note) ? {} : { [Resources.noteVariable]: note };
    if (family === ShellFamily.PowerShell)
      return new ShellLaunch(shell.file, [...shell.args, ...Resources.powerShellIntegrationArguments, ShellIntegration.encode(
        [Resources.shellIntegrationPowerShellNonce, Resources.shellIntegrationPowerShellNote, Resources.shellIntegrationPowerShellProfiles, shell.startCommand,
          Resources.shellIntegrationPowerShellScript].filter(t => !Object.isNull(t)).join(Resources.lineFeed))], {
        [Resources.nonceFileVariable]: nonceFile,
        ...noteVariables
      }, nonce, nonceFile, !Object.isNull(note));
    if (family === ShellFamily.Bash) {
      const bashScript: string = path.join(folder, Resources.bashScriptFile).replaceAll(Resources.windowsSeparator, Resources.posixSeparator);
      const isLogin: boolean = shell.args.some(t => Resources.loginArguments.includes(t));
      return new ShellLaunch(shell.file, [Resources.initFileArgument, bashScript, Resources.interactiveArgument], {
        [Resources.nonceFileVariable]: nonceFile.replaceAll(Resources.windowsSeparator, Resources.posixSeparator),
        ...(isLogin ? { [Resources.loginVariable]: Resources.shellIntegrationLoginValue } : {}),
        ...noteVariables
      }, nonce, nonceFile, !Object.isNull(note));
    }
    const userFolder: string | undefined = environment[Resources.zdotdirVariable];
    return new ShellLaunch(shell.file, shell.args, {
      [Resources.nonceFileVariable]: nonceFile,
      [Resources.zdotdirVariable]: folder,
      ...(Object.isUndefined(userFolder) ? {} : { [Resources.userZdotdirVariable]: userFolder }),
      ...noteVariables
    }, nonce, nonceFile, !Object.isNull(note));
  }

  private makeSharedMemoryFolderAsync(environment: Readonly<Record<string, string | undefined>>): Promise<void> {
    const runtimeFolder: string | undefined = environment[Resources.runtimeFolderVariable];
    if (this.platform !== Resources.linuxPlatform || Object.isUndefined(runtimeFolder) || !path.posix.isAbsolute(runtimeFolder))
      return Promise.resolve();
    const dotnetFolder: string = path.posix.join(runtimeFolder, Resources.dotnetFolder);
    const folder: string = path.posix.join(dotnetFolder, Resources.dotnetSharedMemoryFolder);
    const made: Promise<void> = this.sharedMemoryFolders.get(folder) ?? this.createSharedMemoryFolderAsync(dotnetFolder, folder);
    this.sharedMemoryFolders.set(folder, made);
    return made;
  }

  private async createSharedMemoryFolderAsync(dotnetFolder: string, folder: string): Promise<void> {
    try {
      await this.writer.createMissingFolderAsync(dotnetFolder, Resources.dotnetSharedMemoryFolderMode);
      await this.writer.createMissingFolderAsync(folder, Resources.dotnetSharedMemoryFolderMode);
    }
    catch (error: unknown) {
      this.log.write(Resources.formatDotnetSharedMemoryFolderFailed(folder, FailureText.read(error)));
    }
  }

  private async writeScriptsOrNullAsync(): Promise<string | null> {
    this.folder ??= this.writeScriptsAsync();
    try {
      return await this.folder;
    }
    catch (error: unknown) {
      this.folder = null;
      this.log.write(Resources.formatIntegrationFailed(FailureText.read(error)));
      return null;
    }
  }

  private async writeNonceOrNullAsync(folder: string, nonce: string): Promise<string | null> {
    const nonceFile: string = path.join(folder, `${Resources.nonceFilePrefix}${randomBytes(Resources.nonceFileNameBytes).toString(Resources.hexEncoding)}`);
    try {
      await this.writer.writeTextAsync(nonceFile, `${nonce}${Resources.lineFeed}`);
      return nonceFile;
    }
    catch (error: unknown) {
      this.log.write(Resources.formatNonceFileFailed(FailureText.read(error)));
      return null;
    }
  }

  private async writeScriptsAsync(): Promise<string> {
    const folder: string = await this.writer.createPrivateFolderAsync(path.join(this.temporaryFolder, Resources.integrationFolderPrefix));
    try {
      await this.access?.restrictAsync(folder);
      for (const [name, text] of [
        [Resources.bashScriptFile, Resources.shellIntegrationBashScript],
        [Resources.zshEnvironmentFile, Resources.shellIntegrationZshEnvironment],
        [Resources.zshProfileFile, Resources.shellIntegrationZshProfile],
        [Resources.zshInteractiveFile, Resources.shellIntegrationZshInteractive],
        [Resources.zshLoginFile, Resources.shellIntegrationZshLogin]
      ] as const)
        await this.writer.writeTextAsync(path.join(folder, name), text);
    }
    catch (error: unknown) {
      await this.writer.removeFolderAsync(folder)
        .catch((removalError: unknown) => this.log.write(Resources.formatIntegrationRemovalFailed(FailureText.read(removalError))));
      throw error;
    }
    return folder;
  }

  private static toCommandPromptLaunch(shell: Shell, note: string | null): ShellLaunch {
    const [first, ...start] = shell.args;
    if (Object.isNull(note) || (!Object.isUndefined(first) && first.toLowerCase() !== Resources.keepOpenArgument))
      return new ShellLaunch(shell.file, shell.args, {}, null);
    return new ShellLaunch(shell.file, Resources.formatCmdNoteLine(shell.file, Resources.noteVariable, Resources.formatCmdStart(start)),
      { [Resources.noteVariable]: note.slice(0, note.length - Resources.noteLineBreak.length) }, null, null, true);
  }

  private static toPlainLaunch(shell: Shell, family: ShellFamily): ShellLaunch {
    if (family !== ShellFamily.PowerShell || Object.isNull(shell.startCommand))
      return new ShellLaunch(shell.file, shell.args, {}, null);
    return new ShellLaunch(shell.file, [...shell.args, ...Resources.powerShellArguments, ShellIntegration.encode(shell.startCommand)], {}, null);
  }

  private static toPowerShellLoginLaunch(launch: ShellLaunch): ShellLaunch {
    const [first, ...rest]: string[] = [launch.args].flat();
    if (Object.isUndefined(first) || !ShellIntegration.isPowerShellLogin(first))
      return launch;
    return new ShellLaunch(Resources.powerShellLoginShell, [...Resources.powerShellLoginShellArguments, launch.file, ...rest],
      { ...launch.environment, [Resources.powerShellLoginCheckedVariable]: Resources.powerShellLoginCheckedValue }, launch.nonce, launch.nonceFile,
      launch.printsNote);
  }

  private static isPowerShellLogin(argument: string): boolean {
    return argument.length > 1 && Resources.powerShellLoginParameter.startsWith(argument.toLowerCase());
  }

  private static toFamily(file: string): ShellFamily {
    const name: string = path.win32.parse(file).name.toLowerCase();
    switch (name) {
      case Resources.bashExecutable:
        return ShellFamily.Bash;
      case Resources.zshExecutable:
        return ShellFamily.Zsh;
      case Resources.cmdExecutable:
        return ShellFamily.CommandPrompt;
      case Resources.pwshExecutable:
      case Resources.windowsPowerShellExecutable:
        return ShellFamily.PowerShell;
      default:
        return ShellFamily.Other;
    }
  }

  private static encode(script: string): string {
    return Buffer.from(script, Resources.utf16Encoding).toString(Resources.base64Encoding);
  }
}
