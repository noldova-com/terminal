/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import path from "node:path";

import type { IModuleLog } from "@noldova/desktop.runtime";
import { TerminalShellKind, TerminalSize } from "@noldova/terminal.protocol";

import type { IPtyProcess } from "../interfaces/i-pty-process.ts";
import { OneShotLaunch } from "../models/one-shot-launch.ts";
import type { Shell } from "../models/shell.ts";
import { Resources } from "../resources.ts";
import { CommandStatus } from "../tools/enums/command-status.ts";
import { RunMethod } from "../tools/enums/run-method.ts";
import type { IAgentCommand } from "../tools/interfaces/i-agent-command.ts";
import type { OutputChunk } from "../tools/models/output-chunk.ts";
import { ChangeSignal } from "./change-signal.ts";
import { FailureText } from "./failure-text.ts";
import type { LogFile } from "./log-file.ts";
import { OutputLog } from "./output-log.ts";
import { PseudoTerminal } from "./pseudo-terminal.ts";
import type { TerminalHost } from "./terminal-host.ts";

export class OneShotCommand implements IAgentCommand {
  private readonly output: OutputLog = new OutputLog();
  private readonly changes: ChangeSignal = new ChangeSignal();
  private readonly log: IModuleLog;
  private terminal: PseudoTerminal | null = null;
  private hasEnded: boolean = false;
  private isKilled: boolean = false;
  private code: number | null = null;
  private readonly timer: NodeJS.Timeout | undefined;

  public readonly method: RunMethod = RunMethod.OneShot;
  public readonly logFile: string;
  public readonly started: Promise<void>;

  public constructor(host: TerminalHost, shell: Shell, folder: string, command: string, timeoutMilliseconds: number, logFile: LogFile, log: IModuleLog) {
    this.logFile = logFile.path;
    this.log = log;
    this.output.subscribe(t => logFile.append(t));
    this.timer = timeoutMilliseconds > 0 ? setTimeout(() => this.interrupt(), timeoutMilliseconds).unref() : undefined;
    this.started = this.startAsync(host, shell, folder, command);
  }

  public get status(): CommandStatus {
    if (this.hasEnded)
      return this.isKilled ? CommandStatus.Killed : CommandStatus.Exited;
    return this.output.isAwaitingSecret ? CommandStatus.AwaitingInput : CommandStatus.Running;
  }

  public get exitCode(): number | null {
    return this.code;
  }

  public get cwd(): string | null {
    return null;
  }

  public get isRunning(): boolean {
    return !this.hasEnded;
  }

  public readSince(offset: number): OutputChunk {
    return this.output.readSince(offset);
  }

  public waitForOutputAsync(offset: number, timeoutMilliseconds: number, signal: AbortSignal): Promise<void> {
    return this.changes.waitUntilAsync(() => this.hasEnded || this.output.endOffset > offset, timeoutMilliseconds, signal);
  }

  public waitForEndAsync(timeoutMilliseconds: number, signal: AbortSignal): Promise<void> {
    return this.changes.waitUntilAsync(() => this.hasEnded, timeoutMilliseconds, signal);
  }

  public write(data: string): void {
    this.terminal?.write(data);
  }

  public async endAsync(): Promise<void> {
    await this.started;
    if (!Object.isNull(this.terminal) && !this.hasEnded)
      await this.terminal.endAsync();
  }

  public interrupt(): boolean {
    if (this.hasEnded || this.isKilled)
      return false;
    this.isKilled = true;
    void this.endAsync();
    return true;
  }

  public static toLaunch(shell: Shell, command: string): OneShotLaunch {
    if (shell.kind === TerminalShellKind.Wsl)
      return new OneShotLaunch(shell.file, [...shell.args, ...Resources.wslOneShotArguments, command]);
    switch (path.win32.parse(shell.file).name.toLowerCase()) {
      case Resources.cmdExecutable:
        return OneShotCommand.toCmdLaunch(shell, command);
      case Resources.pwshExecutable:
      case Resources.windowsPowerShellExecutable:
        return new OneShotLaunch(shell.file,
          [...Resources.powerShellOneShotArguments, Object.isNull(shell.startCommand) ? command : `${shell.startCommand}${Resources.lineFeed}${command}`]);
      default:
        return new OneShotLaunch(shell.file, [...Resources.posixOneShotArguments, command]);
    }
  }

  private async startAsync(host: TerminalHost, shell: Shell, folder: string, command: string): Promise<void> {
    try {
      const launch: OneShotLaunch = OneShotCommand.toLaunch(shell, command);
      const process: IPtyProcess = await host.spawnAsync(launch.file, launch.args, folder, new TerminalSize(Resources.agentColumns, Resources.agentRows),
        launch.environment);
      this.terminal = new PseudoTerminal(process, {
        onData: t => {
          this.output.append(t);
          this.changes.notify();
        },
        onExit: t => this.end(t)
      });
    } catch (error: unknown) {
      const message: string = Resources.formatOneShotFailed(FailureText.read(error));
      this.log.write(message);
      this.output.append(message);
      this.end(null);
    }
  }

  private end(exitCode: number | null): void {
    clearTimeout(this.timer);
    this.code = exitCode;
    this.hasEnded = true;
    this.changes.notify();
  }

  private static toCmdLaunch(shell: Shell, command: string): OneShotLaunch {
    const [first, ...start] = shell.args;
    if (first?.toLowerCase() !== Resources.keepOpenArgument || start.length === 0)
      return new OneShotLaunch(shell.file, Resources.formatCmdOneShotLine(command));
    return new OneShotLaunch(shell.file,
      Resources.formatCmdStartedOneShotLine(Resources.formatCmdStart(start), shell.file, Resources.oneShotCommandVariable),
      { [Resources.oneShotCommandVariable]: command });
  }
}
