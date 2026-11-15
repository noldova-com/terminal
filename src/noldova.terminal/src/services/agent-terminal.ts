/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import type { IModuleLog } from "@noldova/desktop.runtime";

import type { IFileSystemWriter } from "../interfaces/i-file-system-writer.ts";
import type { HostedTerminal } from "../models/hosted-terminal.ts";
import { TerminalPrompt } from "../models/terminal-prompt.ts";
import { Resources } from "../resources.ts";
import { CommandStatus } from "../tools/enums/command-status.ts";
import { StaleTerminalException } from "../tools/exceptions/stale-terminal.exception.ts";
import type { IAgentCommand } from "../tools/interfaces/i-agent-command.ts";
import type { IAgentTerminal } from "../tools/interfaces/i-agent-terminal.ts";
import type { ITerminalPrompt } from "../tools/interfaces/i-terminal-prompt.ts";
import type { OutputChunk } from "../tools/models/output-chunk.ts";
import { LogFile } from "./log-file.ts";
import { OneShotCommand } from "./one-shot-command.ts";
import { ShellCommand } from "./shell-command.ts";
import type { TerminalHost } from "./terminal-host.ts";
import type { TerminalSession } from "./terminal-session.ts";

export class AgentTerminal implements IAgentTerminal {
  private readonly hosted: HostedTerminal;
  private readonly host: TerminalHost;
  private readonly writer: IFileSystemWriter;
  private readonly logFolder: string;
  private readonly log: IModuleLog;
  private logFile: LogFile | undefined;
  private oneShot: OneShotCommand | undefined;

  public constructor(hosted: HostedTerminal, host: TerminalHost, writer: IFileSystemWriter, logFolder: string, log: IModuleLog) {
    this.hosted = hosted;
    this.host = host;
    this.writer = writer;
    this.logFolder = logFolder;
    this.log = log;
    this.logFile = undefined;
    this.oneShot = undefined;
  }

  public get id(): string {
    return this.session.sessionId;
  }

  public get title(): string {
    return this.session.title;
  }

  public get shellId(): string {
    return this.hosted.shell.id;
  }

  public get shellPath(): string {
    return this.hosted.shell.file;
  }

  public get startFolder(): string {
    return this.hosted.folder;
  }

  public get ownerSessionId(): string | null {
    return this.hosted.ownerSessionId;
  }

  public get owner(): string | null {
    return this.hosted.owner;
  }

  public get hasShellIntegration(): boolean {
    return this.session.commands.hasMarks;
  }

  public get isRunning(): boolean {
    return !this.session.hasExited;
  }

  public get isAwaitingSecret(): boolean {
    if (this.oneShot?.isRunning === true)
      return this.oneShot.status === CommandStatus.AwaitingInput;
    return this.isRunning && !this.session.commands.isAtPrompt && this.session.text.isAwaitingSecret;
  }

  public get hasPendingLine(): boolean {
    return this.hosted.hasRecentInput || (this.hasShellIntegration && (this.session.readPromptLine() ?? "").length > 0);
  }

  private get hasUnechoedInput(): boolean {
    const received: number | null = this.hosted.inputReceivedLength;
    if (received === null || !this.hosted.hasRecentInput)
      return false;
    return !this.hasShellIntegration || this.session.receivedLength <= received;
  }

  private get session(): TerminalSession {
    return this.hosted.session;
  }

  public readPrompt(): ITerminalPrompt {
    if (!this.hasShellIntegration)
      return new TerminalPrompt(this.isRunning && this.oneShot?.isRunning !== true && !this.hasUnechoedInput, null, null, this.isAwaitingSecret,
        this.hosted.inputCount);
    const isIdle: boolean = this.isRunning && !this.hasUnechoedInput && this.session.readPromptLine() === "";
    return new TerminalPrompt(isIdle, this.session.commands.cwd, this.session.commands.promptIdentity, this.isAwaitingSecret, this.hosted.inputCount);
  }

  public readOneShotLine(command: string): string | null {
    return this.hasShellIntegration ? null : OneShotCommand.toLaunch(this.hosted.shell, command).commandLine;
  }

  public run(command: string, expected: ITerminalPrompt, timeoutMilliseconds: number): IAgentCommand {
    this.requireExpected(expected);
    const logFile: LogFile = this.openLogFile();
    if (this.hasShellIntegration)
      return new ShellCommand(this.session, command, timeoutMilliseconds, logFile.path);
    this.oneShot = new OneShotCommand(this.host, this.hosted.shell, this.hosted.folder, command, timeoutMilliseconds, logFile, this.log);
    return this.oneShot;
  }

  public write(keys: string, expected: ITerminalPrompt): void {
    this.requireExpected(expected);
    this.send(keys);
  }

  public interrupt(expected: ITerminalPrompt): void {
    this.requireExpected(expected);
    this.send(Resources.interruptKey);
  }

  public async closeAsync(): Promise<void> {
    await this.oneShot?.endAsync();
    await this.host.closeTerminalAsync(this.id);
    await this.logFile?.flushAsync();
  }

  public readSince(offset: number): OutputChunk {
    return this.session.text.readSince(offset);
  }

  public waitForOutputAsync(offset: number, timeoutMilliseconds: number, signal: AbortSignal): Promise<void> {
    return this.session.changes.waitUntilAsync(() => this.session.hasExited || this.session.text.endOffset > offset, timeoutMilliseconds, signal);
  }

  public async waitForIntegrationAsync(signal: AbortSignal): Promise<void> {
    const isReady = (): boolean => !this.session.hasIntegration || this.session.hasExited || this.session.commands.promptEndOffset !== null;
    await this.session.waitForStartAsync(() => isReady() || this.session.commands.isLoaded, signal);
    if (this.session.commands.isLoaded)
      await this.session.changes.waitUntilAsync(isReady, null, signal);
  }

  private send(data: string): void {
    if (this.oneShot?.isRunning === true)
      this.oneShot.write(data);
    else
      this.session.write(data);
  }

  private openLogFile(): LogFile {
    if (this.logFile === undefined) {
      const logFile: LogFile = new LogFile(this.writer, path.join(this.logFolder, this.id + Resources.logFileExtension), this.log);
      this.session.text.subscribe(t => logFile.append(t));
      this.logFile = logFile;
    }
    return this.logFile;
  }

  private requireExpected(expected: ITerminalPrompt): void {
    if (!this.readPrompt().equals(expected))
      throw new StaleTerminalException(this.id);
  }
}
