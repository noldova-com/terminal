/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalExited } from "@noldova/terminal.protocol";

import { Resources } from "../resources.ts";
import type { CommandTracker } from "../services/command-tracker.ts";
import type { DeferredPtyProcess } from "../services/deferred-pty-process.ts";
import type { TerminalSession } from "../services/terminal-session.ts";
import type { MirrorLine } from "./mirror-line.ts";
import type { RequestClient } from "./request-client.ts";
import type { Shell } from "./shell.ts";
import type { WaitingRun } from "./waiting-run.ts";

export class HostedTerminal {
  private pendingInterrupt: AbortController | null = null;

  public readonly session: TerminalSession;
  public readonly shell: Shell;
  public readonly folder: string;
  public readonly ownerSessionId: string | null;
  public readonly isPanelTerminal: boolean;
  public readonly owner: string | null;
  public readonly connection: number | null;
  public readonly environment: Readonly<Record<string, string>> | null;
  public isRestarting: boolean = false;
  public isEndSent: boolean = false;
  public heldExit: TerminalExited | null = null;
  public inputCount: number = 0;
  public keyCount: number = 0;
  public inputReceivedLength: number | null = null;
  public inputTime: number = 0;
  public inputPrompt: number | null = null;
  public inputCommandMarks: number = 0;
  public restarts: Promise<void> = Promise.resolve();
  public isSized: boolean = false;
  public opensTab: boolean = true;
  public launcher: RequestClient | null = null;
  public fitWindow: RequestClient | null = null;
  public deferredShell: DeferredPtyProcess | null = null;
  public pendingCommand: AbortController | null = null;
  public launchCommandOffset: number | null = null;
  public readonly runs: Map<string, Promise<MirrorLine>> = new Map<string, Promise<MirrorLine>>();
  public name: string | null = null;
  public isRunStarting: boolean = false;
  public waitingRun: WaitingRun | null = null;
  public typedEnds: number = 1;
  public paste: string = "";

  public constructor(session: TerminalSession, shell: Shell, folder: string, ownerSessionId: string | null, isPanelTerminal: boolean,
    owner: string | null, connection: number | null, environment: Readonly<Record<string, string>> | null = null) {
    this.session = session;
    this.shell = shell;
    this.folder = folder;
    this.ownerSessionId = ownerSessionId;
    this.isPanelTerminal = isPanelTerminal;
    this.owner = owner;
    this.connection = connection;
    this.environment = environment;
  }

  public get hasRecentInput(): boolean {
    return Date.now() - this.inputTime < Resources.echoSettleMilliseconds;
  }

  public get hasUnreadInput(): boolean {
    const commands: CommandTracker = this.session.commands;
    const prompt: number | null = commands.promptIdentity;
    return this.hasRecentInput && (this.inputPrompt === null || prompt === null || prompt === this.inputPrompt
      || commands.commandMarks === this.inputCommandMarks);
  }

  public get isFree(): boolean {
    return this.ownerSessionId === null && !this.session.hasExited && !this.isRestarting && this.pendingCommand === null
      && this.session.commands.hasMarks && !this.hasUnreadInput && this.session.readPromptLine() === "";
  }

  public recordInput(isReply: boolean = false, data: string = ""): void {
    this.inputReceivedLength = this.session.receivedLength;
    if (isReply)
      return;
    const commands: CommandTracker = this.session.commands;
    this.record(commands.isWaitingAtPrompt && !HostedTerminal.hasTextAfterLineBreak(data) ? commands.promptIdentity : null);
  }

  public recordRunInput(): void {
    this.inputReceivedLength = this.session.receivedLength;
    this.record(this.typedEnds === 1 ? this.session.commands.promptIdentity : null);
  }

  public addRun(runId: string, startLine: Promise<MirrorLine>): void {
    this.runs.set(runId, startLine);
    for (const [oldest, start] of [...this.runs].slice(0, Math.max(0, this.runs.size - Resources.maximumKeptRuns)))
      this.forgetRun(oldest, start);
  }

  public clearRuns(): void {
    for (const [runId, start] of [...this.runs])
      this.forgetRun(runId, start);
  }

  public beginInterrupt(): AbortSignal {
    const interrupting: AbortController = new AbortController();
    this.pendingInterrupt = interrupting;
    return interrupting.signal;
  }

  public endInterrupt(): void {
    this.pendingInterrupt = null;
  }

  public cancelCommand(): void {
    this.pendingCommand?.abort();
    this.pendingCommand = null;
    this.pendingInterrupt?.abort();
    this.pendingInterrupt = null;
  }

  public isReachedBy(connection: number, isApp: boolean): boolean {
    return this.connection === null ? this.owner !== null && isApp : this.connection === connection;
  }

  private record(prompt: number | null): void {
    this.inputCount++;
    this.inputTime = Date.now();
    this.inputPrompt = prompt;
    this.inputCommandMarks = this.session.commands.commandMarks;
  }

  private static hasTextAfterLineBreak(data: string): boolean {
    return data.replace(Resources.bracketedPastes, "").split(Resources.lineBreaks).slice(1).some(t => t !== "");
  }

  private forgetRun(runId: string, start: Promise<MirrorLine>): void {
    void start.then(t => t.dispose(), () => undefined);
    this.runs.delete(runId);
  }
}
