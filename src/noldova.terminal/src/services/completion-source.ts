/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import type { IModuleLog } from "@noldova/desktop.runtime";
import { Resources as ProtocolResources, TerminalCompletion, TerminalCompletionItem, TerminalCompletionKind, TerminalMissingCommands, TerminalShellKind } from "@noldova/terminal.protocol";

import { CommandFailedException } from "../exceptions/command-failed.exception.ts";
import { CommandTimedOutException } from "../exceptions/command-timed-out.exception.ts";
import type { ICommandRunner } from "../interfaces/i-command-runner.ts";
import type { IFileSystemReader } from "../interfaces/i-file-system-reader.ts";
import { CommandListing } from "../models/command-listing.ts";
import type { CommandRun } from "../models/command-run.ts";
import { CompletionCandidate } from "../models/completion-candidate.ts";
import type { FolderEntry } from "../models/folder-entry.ts";
import { PowerShellLookup } from "../models/powershell-lookup.ts";
import { ShellLine } from "../models/shell-line.ts";
import { Resources } from "../resources.ts";
import { BoundedReads } from "./bounded-reads.ts";
import type { CommandTracker } from "./command-tracker.ts";
import { FailureText } from "./failure-text.ts";
import { PowerShellBinding } from "./powershell-binding.ts";
import { SharedReads } from "./shared-reads.ts";
import { ShellWords } from "./shell-words.ts";

export class CompletionSource {
  private readonly runner: ICommandRunner;
  private readonly isWindows: boolean;
  private readonly paths: typeof path;
  private readonly homeFolder: string;
  private readonly binding: PowerShellBinding;
  private readonly shared: SharedReads;
  private readonly stuck: string[] = [];
  private readonly listed: WeakMap<CommandTracker, CommandListing> = new WeakMap<CommandTracker, CommandListing>();
  private readonly looked: WeakMap<CommandTracker, PowerShellLookup> = new WeakMap<CommandTracker, PowerShellLookup>();
  private readonly skipped: WeakMap<CommandTracker, string> = new WeakMap<CommandTracker, string>();
  private readonly failing: WeakSet<CommandTracker> = new WeakSet<CommandTracker>();
  private readonly lateLookups: WeakSet<CommandTracker> = new WeakSet<CommandTracker>();
  private readonly log: IModuleLog;

  public constructor(fileSystem: IFileSystemReader, runner: ICommandRunner, platform: string, homeFolder: string, log: IModuleLog) {
    this.runner = runner;
    this.log = log;
    this.isWindows = platform === Resources.windowsPlatform;
    this.paths = this.isWindows ? path.win32 : path.posix;
    this.homeFolder = homeFolder;
    this.binding = new PowerShellBinding(this.isWindows);
    this.shared = new SharedReads(fileSystem);
  }

  public async completeAsync(key: string, kind: TerminalShellKind, line: string, cursor: number, folder: string,
    environment: Readonly<Record<string, string>>, shellNames: ReadonlySet<string> | null, shellBuiltins: ReadonlySet<string> | null): Promise<TerminalCompletion> {
    if (!Resources.completedShellKinds.includes(kind) || this.stuck.includes(key))
      return new TerminalCompletion(cursor, []);
    const builtins: readonly string[] = kind === TerminalShellKind.PowerShell ? Resources.powerShellBuiltins
      : [...new Set([...shellBuiltins ?? [], ...shellNames ?? []])]
        .filter(t => !t.startsWith(Resources.helperNamePrefix) && t !== Resources.autocdName && !t.startsWith(Resources.suffixAliasNameStart));
    return this.readAsync(key, t => this.completeLineAsync(t, kind, builtins, line.slice(0, cursor), folder, environment));
  }

  public followsCommand(kind: TerminalShellKind, line: string, cursor: number): boolean {
    return ShellWords.read(line.slice(0, cursor), kind === TerminalShellKind.PowerShell).words.length > 0;
  }

  public addOptions(completion: TerminalCompletion, kind: TerminalShellKind, line: string, cursor: number, options: readonly string[]): TerminalCompletion {
    const ignoresCase: boolean = this.isWindows || kind === TerminalShellKind.PowerShell;
    const toKey = (text: string): string => ignoresCase ? text.toLowerCase() : text;
    const prefix: string = toKey(line.slice(completion.replaceFrom, cursor));
    const labels: ReadonlySet<string> = new Set(completion.items.map(t => t.label));
    const added: readonly TerminalCompletionItem[] = [...new Set(options)]
      .filter(t => t.trim().length > 0 && t.length <= ProtocolResources.maximumPathLength && !labels.has(t) && toKey(t).startsWith(prefix))
      .map(t => new TerminalCompletionItem(t, t, TerminalCompletionKind.Option));
    if (added.length === 0)
      return completion;
    const items: readonly TerminalCompletionItem[] = [...completion.items, ...added].sort((a, b) => a.label.localeCompare(b.label, Resources.sortLocale));
    return new TerminalCompletion(completion.replaceFrom, items.slice(0, ProtocolResources.maximumCompletionItems));
  }

  public async findMissingAsync(key: string, shell: CommandTracker, prompt: number, kind: TerminalShellKind, folder: string, names: readonly string[],
    shellNames: ReadonlySet<string> | null, environment: Readonly<Record<string, string>>): Promise<TerminalMissingCommands> {
    if (kind === TerminalShellKind.PowerShell || !Resources.completedShellKinds.includes(kind) || shellNames === null || this.stuck.includes(key))
      return new TerminalMissingCommands([]);
    const takesBareNames: boolean = this.isWindows && kind === TerminalShellKind.Bash;
    const search: string = JSON.stringify([kind, this.readVariable(environment, Resources.pathVariable),
      this.readVariable(environment, Resources.pathExtensionsVariable)]);
    const last: CommandListing | undefined = this.listed.get(shell);
    const listed: readonly string[] | null = last !== undefined && last.prompt === prompt && last.search === search ? last.commands : null;
    return this.readAsync(key, async reads => {
      const commands: readonly string[] = listed ?? (await this.listCommandsAsync(reads, [], environment, takesBareNames)).map(t => t.value);
      if (reads.wasCutShort)
        return new TerminalMissingCommands([]);
      this.listed.set(shell, new CommandListing(prompt, search, commands));
      const found: readonly string[] = [...shellNames, ...commands];
      const known: ReadonlySet<string> = new Set(this.isWindows ? found.map(t => t.toLowerCase()) : found);
      const unknown: readonly string[] = names.filter(t => !this.isPath(t) && !t.startsWith(Resources.helperNamePrefix)
        && !known.has(this.toCommandName(t)) && !this.hasSuffixAlias(t, shellNames));
      const missing: readonly string[] = unknown.length > 0 && shellNames.has(Resources.autocdName)
        ? await this.dropFoldersAsync(reads, kind, folder, environment, unknown) : unknown;
      return new TerminalMissingCommands(reads.wasCutShort ? [] : missing);
    });
  }

  public async findMissingPowerShellAsync(shell: CommandTracker, program: string, names: readonly string[], shellNames: ReadonlySet<string> | null,
    environment: Readonly<Record<string, string>>): Promise<TerminalMissingCommands> {
    if (shellNames === null) {
      const reason: string = shell.isPathReset ? Resources.powerShellLookupPathReset : shell.isModulePathReset ? Resources.powerShellLookupModulePathReset
        : shell.isNamesReset ? Resources.powerShellLookupNamesTooLong : Resources.powerShellLookupNamesUnreported;
      if (this.skipped.get(shell) !== reason)
        this.log.write(Resources.formatPowerShellLookupSkipped(reason));
      this.skipped.set(shell, reason);
      return new TerminalMissingCommands([]);
    }
    this.skipped.delete(shell);
    const variables: Readonly<Record<string, string>> = await this.toLongModulePathsAsync(Object.fromEntries([Resources.pathVariable,
      Resources.pathExtensionsVariable, Resources.modulePathVariable].flatMap(t => {
      const value: string | undefined = this.readVariable(environment, this.isWindows ? t.toUpperCase() : t);
      return value === undefined ? [] : [[t, value]];
    })));
    const search: string = JSON.stringify([program, variables]);
    const last: PowerShellLookup | undefined = this.looked.get(shell);
    const answers: Map<string, boolean> = last !== undefined && last.shellNames === shellNames && last.search === search ? last.answers : new Map<string, boolean>();
    this.looked.set(shell, new PowerShellLookup(shellNames, search, answers));
    const known: ReadonlySet<string> = new Set([...shellNames].map(t => t.toLowerCase()));
    const asked: readonly string[] = [...new Set(names)].filter(t => !this.isPath(t) && Resources.powerShellLookupNamePattern.test(t)
      && !known.has(t.toLowerCase()) && !known.has(`${Resources.powerShellImplicitVerb}${t}`.toLowerCase()));
    const unasked: readonly string[] = asked.filter(t => !answers.has(t));
    if (unasked.length > 0 && !this.lateLookups.has(shell)) {
      const run: CommandRun = this.runner.start(program, [...Resources.environmentReadArguments,
        Buffer.from(Resources.formatPowerShellLookupScript(unasked), Resources.utf16Encoding).toString(Resources.base64Encoding)], Resources.powerShellLookupMilliseconds,
        Resources.powerShellLookupEndMilliseconds, variables);
      try {
        const output: string = await run.answer;
        const missing: ReadonlySet<string> = new Set(output.split(Resources.lineBreaks).map(t => t.trim()));
        for (const [index, name] of unasked.entries())
          answers.set(name, missing.has(String(index)));
        this.failing.delete(shell);
      }
      catch (error: unknown) {
        if (!(error instanceof CommandFailedException))
          throw error;
        if (error instanceof CommandTimedOutException) {
          this.lateLookups.add(shell);
          void run.ended.then(() => this.lateLookups.delete(shell));
        }
        if (!this.failing.has(shell))
          this.log.write(Resources.formatPowerShellLookupFailed(unasked.length, FailureText.read(error)));
        this.failing.add(shell);
      }
    }
    return new TerminalMissingCommands(asked.filter(t => answers.get(t) === true));
  }

  private hasSuffixAlias(name: string, shellNames: ReadonlySet<string>): boolean {
    const start: number = name.lastIndexOf(Resources.suffixStart);
    return start > 0 && shellNames.has(`${Resources.suffixAliasNameStart}${name.slice(start + 1)}`);
  }

  private async dropFoldersAsync(reads: BoundedReads, kind: TerminalShellKind, folder: string, environment: Readonly<Record<string, string>>,
    names: readonly string[]): Promise<readonly string[]> {
    const workFolder: string | null = this.toLocalPath(folder, kind, this.readVariable(environment, Resources.temporaryFolderVariable) ?? null);
    if (workFolder === null)
      return names;
    const folders: ReadonlySet<string> = new Set((await reads.readEntriesAsync(workFolder)).filter(t => t.isFolder)
      .map(t => this.isWindows ? t.name.toLowerCase() : t.name));
    return names.filter(t => !folders.has(this.isWindows ? t.toLowerCase() : t));
  }

  private async readAsync<T>(key: string, list: (reads: BoundedReads) => Promise<T>): Promise<T> {
    const reads: BoundedReads = new BoundedReads(this.shared, Resources.completionReadMilliseconds);
    try {
      return await list(reads);
    }
    finally {
      reads.end();
      for (const read of reads.listPendingReads()) {
        this.stuck.push(key);
        void Promise.allSettled([read]).then(() => this.stuck.splice(this.stuck.indexOf(key), 1));
      }
    }
  }

  private async completeLineAsync(reads: BoundedReads, kind: TerminalShellKind, builtins: readonly string[], line: string, folder: string,
    environment: Readonly<Record<string, string>>): Promise<TerminalCompletion> {
    const isPowerShell: boolean = kind === TerminalShellKind.PowerShell;
    const typed: ShellLine = ShellWords.read(line, isPowerShell);
    const escapesWildcards: boolean = isPowerShell && this.binding.bindsWildcardPath(typed.words);
    const shellLine: ShellLine = escapesWildcards
      ? new ShellLine(typed.words, typed.start, typed.value.replace(Resources.powerShellEscapedWildcards, Resources.completionSourceEscapedWildcardReplacement), typed.quote, typed.startsQuoted)
      : typed;
    const ignoresCase: boolean = this.isWindows || isPowerShell;
    const prefix: string = ignoresCase ? shellLine.value.toLowerCase() : shellLine.value;
    const expandsHome: boolean = isPowerShell || !shellLine.startsQuoted;
    const keepsHome: boolean = expandsHome && this.isHome(shellLine.value);
    const candidates: readonly CompletionCandidate[] = (await this.listAsync(reads, kind, builtins, shellLine, folder, environment, expandsHome))
      .filter(t => (ignoresCase ? t.value.toLowerCase() : t.value).startsWith(prefix));
    const items: TerminalCompletionItem[] = [...new Map(candidates.map(t => [t.value, t])).values()]
      .sort((a, b) => a.label.localeCompare(b.label, Resources.sortLocale))
      .map((t): [string, CompletionCandidate] => [ShellWords.write(t.value, shellLine.quote, isPowerShell, t.closesQuote,
        escapesWildcards && (t.kind === TerminalCompletionKind.File || t.kind === TerminalCompletionKind.Folder), keepsHome), t])
      .filter(([t]) => t.length <= ProtocolResources.maximumPathLength)
      .map(([text, t]) => new TerminalCompletionItem(text, t.label, t.kind));
    return new TerminalCompletion(shellLine.start, items.slice(0, ProtocolResources.maximumCompletionItems));
  }

  private listAsync(reads: BoundedReads, kind: TerminalShellKind, builtins: readonly string[], shellLine: ShellLine, folder: string,
    environment: Readonly<Record<string, string>>, expandsHome: boolean): Promise<readonly CompletionCandidate[]> {
    const words: readonly string[] = shellLine.words.map(t => this.toCommandName(t));
    if (words.length === 0 && !this.isPath(shellLine.value))
      return this.listCommandsAsync(reads, builtins, environment);
    const temporaryFolder: string | null = this.readVariable(environment, Resources.temporaryFolderVariable) ?? null;
    const workFolder: string | null = this.toLocalPath(folder, kind, temporaryFolder);
    if (workFolder !== null && words.length === Resources.subcommandWordCount && words[0] === Resources.gitCommand && Resources.gitBranchCommands.some(t => shellLine.words[1] === t))
      return this.listBranchesAsync(reads, workFolder, environment);
    if (workFolder !== null && words.length === Resources.subcommandWordCount && words[0] === Resources.npmCommand && Resources.npmRunCommands.some(t => shellLine.words[1] === t))
      return this.listScriptsAsync(reads, workFolder);
    return this.listPathsAsync(reads, kind, shellLine.value, workFolder, expandsHome, temporaryFolder);
  }

  private async listPathsAsync(reads: BoundedReads, kind: TerminalShellKind, value: string, workFolder: string | null,
    expandsHome: boolean, temporaryFolder: string | null): Promise<readonly CompletionCandidate[]> {
    const end: number = Math.max(value.lastIndexOf(Resources.posixSeparator), this.isWindows ? value.lastIndexOf(Resources.windowsSeparator) : -1);
    const typedFolder: string = value.slice(0, end + 1);
    const folder: string | null = workFolder === null ? null : this.toFolder(kind, typedFolder, workFolder, expandsHome, temporaryFolder);
    if (folder === null)
      return [];
    const separator: string = end >= 0 ? value.charAt(end)
      : this.isWindows && kind === TerminalShellKind.PowerShell ? Resources.windowsSeparator : Resources.posixSeparator;
    const showsHidden: boolean = value.slice(end + 1).startsWith(Resources.hiddenPrefix);
    return (await reads.readEntriesAsync(folder))
      .filter(t => showsHidden || !t.name.startsWith(Resources.hiddenPrefix))
      .map(t => t.isFolder
        ? new CompletionCandidate(`${typedFolder}${t.name}${separator}`, `${t.name}${separator}`, TerminalCompletionKind.Folder, false)
        : new CompletionCandidate(`${typedFolder}${t.name}`, t.name, TerminalCompletionKind.File, true));
  }

  private async listCommandsAsync(reads: BoundedReads, builtins: readonly string[], environment: Readonly<Record<string, string>>,
    takesBareNames: boolean = false): Promise<readonly CompletionCandidate[]> {
    const extensions: readonly string[] | null = this.isWindows
      ? (this.readVariable(environment, Resources.pathExtensionsVariable) ?? Resources.defaultPathExtensions).toLowerCase()
        .split(path.win32.delimiter).filter(t => t !== "")
      : null;
    const entries: readonly (readonly FolderEntry[])[] = await Promise.all(this.searchFolders(environment).map(t => reads.readEntriesAsync(t)));
    const names: string[] = [...builtins];
    for (const entry of entries.flat()) {
      const extension: string = this.paths.extname(entry.name).toLowerCase();
      if (!entry.isFolder && (extensions === null || extensions.includes(extension) || takesBareNames && extension === ""))
        names.push(extensions === null ? entry.name : entry.name.slice(0, entry.name.length - extension.length));
    }
    return names.map(t => new CompletionCandidate(t, t, TerminalCompletionKind.Command, true));
  }

  private async listBranchesAsync(reads: BoundedReads, folder: string,
    environment: Readonly<Record<string, string>>): Promise<readonly CompletionCandidate[]> {
    const git: string | null = await this.findProgramAsync(reads, this.isWindows ? Resources.gitExecutableFile : Resources.gitCommand, environment);
    if (git === null)
      return [];
    let output: string;
    try {
      output = await this.runner.runAsync(git, [Resources.completionSourceGitFolderArgument, folder, ...Resources.gitBranchArguments], Resources.completionCommandMilliseconds);
    }
    catch (error: unknown) {
      if (error instanceof CommandFailedException)
        return [];
      throw error;
    }
    return output.split(Resources.lineBreaks)
      .filter(t => !t.endsWith(Resources.remoteHeadSuffix))
      .map(t => t.startsWith(Resources.headsPrefix) ? t.slice(Resources.headsPrefix.length)
        : t.startsWith(Resources.remotesPrefix) ? t.slice(Resources.remotesPrefix.length) : "")
      .filter(t => t !== "")
      .map(t => new CompletionCandidate(t, t, TerminalCompletionKind.Branch, true));
  }

  private async listScriptsAsync(reads: BoundedReads, folder: string): Promise<readonly CompletionCandidate[]> {
    let current: string = folder;
    let text: string | null = await reads.readTextOrNullAsync(this.paths.join(current, Resources.packageFile));
    while (text === null && this.paths.dirname(current) !== current) {
      current = this.paths.dirname(current);
      text = await reads.readTextOrNullAsync(this.paths.join(current, Resources.packageFile));
    }
    if (text === null)
      return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    }
    catch (error: unknown) {
      if (!(error instanceof SyntaxError))
        throw error;
      return [];
    }
    if (typeof parsed !== "object" || parsed === null || !(Resources.packageScriptsField in parsed))
      return [];
    const scripts: unknown = parsed[Resources.packageScriptsField];
    if (typeof scripts !== "object" || scripts === null || Array.isArray(scripts))
      return [];
    return Object.keys(scripts).map(t => new CompletionCandidate(t, t, TerminalCompletionKind.Script, true));
  }

  private async findProgramAsync(reads: BoundedReads, name: string, environment: Readonly<Record<string, string>>): Promise<string | null> {
    for (const folder of this.searchFolders(environment)) {
      const file: string = this.paths.join(folder, name);
      if (await reads.isProgramAsync(file))
        return file;
    }
    return null;
  }

  private searchFolders(environment: Readonly<Record<string, string>>): readonly string[] {
    return [...new Set((this.readVariable(environment, Resources.pathVariable) ?? "").split(this.paths.delimiter).filter(t => this.paths.isAbsolute(t)))];
  }

  private async toLongModulePathsAsync(variables: Readonly<Record<string, string>>): Promise<Readonly<Record<string, string>>> {
    const modulePath: string | undefined = variables[Resources.modulePathVariable];
    if (!this.isWindows || modulePath === undefined || !modulePath.includes(Resources.shortNameMark))
      return variables;
    const reads: BoundedReads = new BoundedReads(this.shared, Resources.completionReadMilliseconds);
    try {
      const entries: readonly string[] = await Promise.all(modulePath.split(Resources.windowsPathListSeparator)
        .map(async t => t.includes(Resources.shortNameMark) ? await reads.readRealPathOrNullAsync(t) ?? t : t));
      return { ...variables, [Resources.modulePathVariable]: entries.join(Resources.windowsPathListSeparator) };
    }
    finally {
      reads.end();
    }
  }

  private readVariable(environment: Readonly<Record<string, string>>, name: string): string | undefined {
    return this.isWindows ? Object.entries(environment).find(([t]) => t.toUpperCase() === name)?.[1] : environment[name];
  }

  private toFolder(kind: TerminalShellKind, typedFolder: string, workFolder: string, expandsHome: boolean, temporaryFolder: string | null): string | null {
    const folder: string | null = expandsHome && this.isHome(typedFolder) ? this.paths.join(this.homeFolder, typedFolder.slice(Resources.homePrefix.length)) : this.toLocalPath(typedFolder, kind, temporaryFolder);
    return folder === null ? null : this.paths.resolve(workFolder, folder);
  }

  private toLocalPath(value: string, kind: TerminalShellKind, temporaryFolder: string | null): string | null {
    if (!this.isWindows || kind !== TerminalShellKind.Bash || !value.startsWith(Resources.posixSeparator))
      return value;
    const temporary: string = Resources.gitBashTemporaryFolder;
    if (temporaryFolder !== null && path.win32.isAbsolute(temporaryFolder)
      && (value === temporary || value.startsWith(`${temporary}${Resources.posixSeparator}`)))
      return path.win32.join(temporaryFolder, value.slice(temporary.length));
    if (!Resources.gitBashDrivePath.test(value))
      return null;
    return Resources.formatCompletionSourceWindowsDrivePath(value.charAt(1).toUpperCase(),
      value.slice(Resources.completionSourceGitBashDrivePrefixLength).replaceAll(Resources.posixSeparator, Resources.windowsSeparator));
  }

  private toCommandName(word: string): string {
    const name: string = this.paths.basename(word);
    return this.isWindows ? name.toLowerCase().replace(Resources.windowsProgramExtension, "") : name;
  }

  private isHome(value: string): boolean {
    return value.startsWith(Resources.homePrefix) || (this.isWindows && value.startsWith(Resources.windowsHomePrefix));
  }

  private isPath(value: string): boolean {
    return value.includes(Resources.posixSeparator) || (this.isWindows && value.includes(Resources.windowsSeparator))
      || value.startsWith(Resources.hiddenPrefix) || value.startsWith(Resources.homeWord);
  }
}
