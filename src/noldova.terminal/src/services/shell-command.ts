/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { TrackedCommand } from "../models/tracked-command.ts";
import type { TypedLine } from "../models/typed-line.ts";
import { Resources } from "../resources.ts";
import { CommandStatus } from "../tools/enums/command-status.ts";
import { RunMethod } from "../tools/enums/run-method.ts";
import type { IAgentCommand } from "../tools/interfaces/i-agent-command.ts";
import type { OutputChunk } from "../tools/models/output-chunk.ts";
import type { TerminalSession } from "./terminal-session.ts";

export class ShellCommand implements IAgentCommand {
  private readonly session: TerminalSession;
  private readonly line: TypedLine;
  private readonly run: number;
  private isKilled: boolean = false;
  private givenUp: readonly [number, number] | null = null;

  public readonly method: RunMethod = RunMethod.InShell;
  public readonly logFile: string;

  public constructor(session: TerminalSession, command: string, timeoutMilliseconds: number, logFile: string) {
    this.session = session;
    this.logFile = logFile;
    this.run = session.run;
    this.line = session.typeLine(command);
    if (timeoutMilliseconds > 0) {
      const limit: AbortController = new AbortController();
      const timer: NodeJS.Timeout = setTimeout(() => limit.abort(), timeoutMilliseconds).unref();
      void session.changes.waitUntilAsync(() => this.hasEnded, null, limit.signal).then(() => {
        clearTimeout(timer);
        if (limit.signal.aborted)
          this.interrupt();
      });
    }
  }

  public get status(): CommandStatus {
    if (!Object.isNull(this.givenUp))
      return CommandStatus.Killed;
    if (this.tracked?.hasEnded === true || !Object.isNull(this.unmarkedEnd))
      return this.isKilled ? CommandStatus.Killed : CommandStatus.Exited;
    if (!Object.isNull(this.restartEnd) || this.session.hasExited)
      return CommandStatus.Killed;
    return this.session.text.isAwaitingSecret ? CommandStatus.AwaitingInput : CommandStatus.Running;
  }

  public get exitCode(): number | null {
    return Object.isNull(this.givenUp) ? this.tracked?.exitCode ?? null : null;
  }

  public get cwd(): string | null {
    return Object.isNull(this.givenUp) ? this.tracked?.cwd ?? null : null;
  }

  private get hasEnded(): boolean {
    return !Object.isNull(this.givenUp) || this.tracked?.hasEnded === true || !Object.isNull(this.unmarkedEnd) || !Object.isNull(this.restartEnd) || this.session.hasExited;
  }

  private get outputStart(): number {
    if (!Object.isNull(this.givenUp))
      return this.givenUp[0];
    const tracked: TrackedCommand | null = this.tracked;
    return tracked?.hasOutputStart === true ? tracked.outputStart : this.line.startOffset;
  }

  private get outputEnd(): number {
    return this.givenUp?.[1] ?? this.tracked?.outputEnd ?? this.unmarkedEnd ?? this.restartEnd ?? this.session.text.endOffset;
  }

  private get restartEnd(): number | null {
    return this.session.endOfRun(this.run);
  }

  private get unmarkedEnd(): number | null {
    return this.line.endOffset;
  }

  private get tracked(): TrackedCommand | null {
    return this.line.command;
  }

  public readSince(offset: number): OutputChunk {
    return this.session.text.readChunk(Math.max(offset, this.outputStart), this.outputEnd);
  }

  public waitForOutputAsync(offset: number, timeoutMilliseconds: number, signal: AbortSignal): Promise<void> {
    return this.session.changes.waitUntilAsync(() => this.hasEnded || this.outputEnd > Math.max(offset, this.outputStart), timeoutMilliseconds, signal);
  }

  public waitForEndAsync(timeoutMilliseconds: number, signal: AbortSignal): Promise<void> {
    return this.session.changes.waitUntilAsync(() => this.hasEnded, timeoutMilliseconds, signal);
  }

  public interrupt(): boolean {
    if (this.hasEnded || this.isKilled)
      return false;
    this.isKilled = true;
    this.session.write(Resources.interruptKey);
    setTimeout(() => {
      if (this.hasEnded)
        return;
      this.givenUp = [this.outputStart, this.outputEnd];
      this.session.changes.notify();
    }, Resources.graceMilliseconds).unref();
    return true;
  }
}
