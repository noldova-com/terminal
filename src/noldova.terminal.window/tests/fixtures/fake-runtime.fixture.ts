/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { JsonValue } from "@noldova/context.json";
import { FailureCode } from "@noldova/desktop.protocol";
import { EndedBy, TerminalAttachment, TerminalCommandAdded, TerminalCwd, TerminalExit, TerminalExited, TerminalLinePage, TerminalLaunched, TerminalLaunchParams, TerminalLineRange, TerminalLinesParams, TerminalName, TerminalNames, TerminalOpenParams, TerminalOutput, TerminalOwnerReference, TerminalPaneReference, TerminalReference, TerminalRestartParams, TerminalRestoreParams, TerminalRunOutcome, TerminalRunOutputParams, TerminalRunParams, TerminalRunResult, TerminalSessions, TerminalShell, TerminalShellKind, TerminalShells, TerminalSize, TerminalSummary, TerminalTitle, type TerminalInputMark, type TerminalInputStart, type TerminalLine, type TerminalRunEnded, type TerminalRunOutput, type WindowsPty } from "@noldova/terminal.protocol";

import { HeldAnswer } from "./held-answer.fixture.ts";
import { TerminalPartContext } from "./terminal-part-context.fixture.ts";

export class FakeRuntime {
  private readonly attaches: (() => void)[] = [];
  private readonly linesReads: (() => void)[] = [];
  private readonly opens: (() => void)[] = [];
  private isHoldingAttaches: boolean = false;
  private isHoldingLines: boolean = false;
  private isHoldingOpens: boolean = false;
  private openedCount: number = 0;
  private runCount: number = 0;
  private listings: number = 0;
  private heldListing: HeldAnswer = new HeldAnswer();
  private isListingHeld: (listing: number) => boolean = () => false;

  public readonly context: TerminalPartContext;
  public readonly sessions: TerminalSummary[] = [];
  public readonly saved: TerminalSummary[] = [];
  public readonly shells: TerminalShell[] = [new TerminalShell("bash", "Bash", TerminalShellKind.Bash, true),
    new TerminalShell("zsh", "Zsh", TerminalShellKind.Zsh, false)];
  public shellsFailure: unknown = null;
  public sessionsFailure: unknown = null;
  public sessionsFailureFrom: number = 1;
  public snapshot: string = "";
  public pending: string = "";
  public offset: number = 0;
  public size: TerminalSize = new TerminalSize(80, 24);
  public title: string = "";
  public cwd: string | null = null;
  public exit: TerminalExit | null = null;
  public windowsPty: WindowsPty | null = null;
  public stored: TerminalLineRange = new TerminalLineRange(0, 0);
  public input: TerminalInputStart | null = null;
  public commands: readonly string[] = [];
  public shellKind: TerminalShellKind = TerminalShellKind.Other;
  public storedLines: TerminalLine[] = [];
  public linesFailure: Error | null = null;
  public attachFailure: Error | null = null;
  public openFailure: Error | null = null;
  public restartFailure: Error | null = null;
  public readonly missingFolders: Set<string> = new Set<string>();
  public readonly freeSessions: Set<string> = new Set<string>();
  public announcesRuns: boolean = true;
  public runOutcome: TerminalRunOutcome = TerminalRunOutcome.Typed;
  public answerEnds: readonly TerminalRunEnded[] = [];
  public runOutput: TerminalRunOutput | null = null;

  public constructor(context: TerminalPartContext = new TerminalPartContext()) {
    this.context = context;
    context.handlers.set(TerminalNames.attachMethod, t => this.attachAsync(t));
    context.handlers.set(TerminalNames.linesMethod, t => this.readLinesAsync(TerminalLinesParams.fromJson(t)));
    context.handlers.set(TerminalNames.shellsMethod, async () => this.listShells());
    context.handlers.set(TerminalNames.sessionsMethod, async () => this.listSessionsAsync());
    context.handlers.set(TerminalNames.openMethod, async t => this.openAsync(TerminalOpenParams.fromJson(t)));
    context.handlers.set(TerminalNames.restartMethod, async t => this.restart(TerminalRestartParams.fromJson(t)));
    context.handlers.set(TerminalNames.restoreMethod, async t => this.restore(TerminalRestoreParams.fromJson(t)));
    context.handlers.set(TerminalNames.closeOwnerMethod, async t => this.closeOwner(TerminalOwnerReference.fromJson(t).owner));
    context.handlers.set(TerminalNames.launchMethod, async t => this.launchAsync(TerminalLaunchParams.fromJson(t)));
    context.handlers.set(TerminalNames.runMethod, async t => this.runAsync(TerminalRunParams.fromJson(t)));
    context.handlers.set(TerminalNames.runOutputMethod, async t => this.readRunOutput(t));
    context.handlers.set(TerminalNames.windowStartedMethod, async () => null);
    context.handlers.set(TerminalNames.showOwnerMethod, async () => null);
    context.handlers.set(TerminalNames.renameMethod, async t => this.rename(TerminalName.fromJson(t)));
    for (const method of [TerminalNames.closeMethod, TerminalNames.inputMethod, TerminalNames.resizeMethod, TerminalNames.ackMethod, TerminalNames.visibilityMethod,
      TerminalNames.detachMethod])
      context.handlers.set(method, async () => null);
  }

  public static refusal(message: string): Error {
    return Object.assign(new Error(message), { code: FailureCode.Internal });
  }

  public static gone(message: string): Error {
    return Object.assign(new Error(message), { code: FailureCode.NotFound });
  }

  public get listingCount(): number {
    return this.listings;
  }

  public holdListings(isHeld: (listing: number) => boolean = () => true): HeldAnswer {
    const first: number = this.listings;
    this.heldListing = new HeldAnswer();
    this.isListingHeld = t => isHeld(t - first);
    return this.heldListing;
  }

  public get attachCount(): number {
    return this.context.sent(TerminalNames.attachMethod).length;
  }

  public addSession(sessionId: string, shellId: string, folder: string, exit: TerminalExit | null = null, isAgentTerminal: boolean = false,
    isPanelTerminal: boolean = false, owner: string | null = null, opensTab: boolean = true, name: string | null = null): void {
    const shell: TerminalShell | undefined = this.shells.find(t => t.id === shellId);
    this.sessions.push(new TerminalSummary(sessionId, shellId, folder, "", exit, isAgentTerminal, isPanelTerminal, owner, opensTab, name,
      shell?.name ?? null, shell?.kind ?? TerminalShellKind.Other));
  }

  public rename(name: TerminalName): JsonValue {
    const index: number = this.sessions.findIndex(t => t.sessionId === name.sessionId);
    const terminal: TerminalSummary | undefined = this.sessions[index];
    if (!Object.isUndefined(terminal))
      this.sessions[index] = new TerminalSummary(terminal.sessionId, terminal.shellId, terminal.folder, terminal.title, terminal.exit,
        terminal.isAgentTerminal, terminal.isPanelTerminal, terminal.owner, terminal.opensTab, name.name, terminal.shellName, terminal.shellKind);
    this.context.emit(TerminalNames.renamedEvent, name.toJson());
    return null;
  }

  public holdAttaches(): void {
    this.isHoldingAttaches = true;
  }

  public releaseAttaches(): void {
    this.isHoldingAttaches = false;
    for (const release of this.attaches.splice(0))
      release();
  }

  public holdLines(): void {
    this.isHoldingLines = true;
  }

  public releaseLines(): void {
    this.isHoldingLines = false;
    for (const release of this.linesReads.splice(0))
      release();
  }

  public holdOpens(): void {
    this.isHoldingOpens = true;
  }

  public releaseOpens(): void {
    this.isHoldingOpens = false;
    for (const release of this.opens.splice(0))
      release();
  }

  public output(sessionId: string, offset: number, data: string, inputs: readonly TerminalInputMark[] = []): void {
    this.context.emit(TerminalNames.outputEvent, new TerminalOutput(sessionId, offset, data, this.stored, inputs).toJson());
  }

  public addCommand(sessionId: string, command: string): void {
    this.context.emit(TerminalNames.commandAddedEvent, new TerminalCommandAdded(sessionId, command).toJson());
  }

  public exitSession(sessionId: string, exitCode: number | null, endedBy: EndedBy = EndedBy.Exit): void {
    this.context.emit(TerminalNames.exitedEvent, new TerminalExited(sessionId, new TerminalExit(exitCode, endedBy)).toJson());
  }

  public restartSession(sessionId: string): void {
    this.context.emit(TerminalNames.restartedEvent, new TerminalReference(sessionId).toJson());
  }

  public retitle(sessionId: string, title: string): void {
    this.context.emit(TerminalNames.titleChangedEvent, new TerminalTitle(sessionId, title).toJson());
  }

  public changeCwd(sessionId: string, cwd: string): void {
    this.context.emit(TerminalNames.cwdChangedEvent, new TerminalCwd(sessionId, cwd).toJson());
  }

  public detach(sessionId: string, paneId: string): void {
    this.context.emit(TerminalNames.detachedEvent, new TerminalPaneReference(sessionId, paneId).toJson());
  }

  private async attachAsync(parameters: JsonValue): Promise<JsonValue> {
    const pane: TerminalPaneReference = TerminalPaneReference.fromJson(parameters);
    const failure: Error | null = this.attachFailure;
    if (this.isHoldingAttaches)
      await new Promise<void>(resolve => this.attaches.push(resolve));
    if (!Object.isNull(failure))
      throw failure;
    return new TerminalAttachment(pane.sessionId, this.snapshot, this.pending, this.offset, this.size, this.title, this.cwd, this.exit, this.windowsPty, this.stored,
      this.input, this.commands, this.shellKind).toJson();
  }

  private async readLinesAsync(params: TerminalLinesParams): Promise<JsonValue> {
    if (this.isHoldingLines)
      await new Promise<void>(resolve => this.linesReads.push(resolve));
    if (!Object.isNull(this.linesFailure))
      throw this.linesFailure;
    const first: number = Math.min(Math.max(params.start, this.stored.start), this.stored.end);
    return new TerminalLinePage(first, this.storedLines.slice(first, Math.min(first + params.limit, this.stored.end)), this.stored).toJson();
  }

  private async listSessionsAsync(): Promise<JsonValue> {
    const listing: number = ++this.listings;
    if (this.isListingHeld(listing))
      await this.heldListing.promise;
    if (!Object.isNull(this.sessionsFailure) && listing >= this.sessionsFailureFrom)
      throw this.sessionsFailure;
    return new TerminalSessions(this.sessions).toJson();
  }

  private listShells(): JsonValue {
    if (!Object.isNull(this.shellsFailure))
      throw this.shellsFailure;
    return new TerminalShells(this.shells).toJson();
  }

  private restart(params: TerminalRestartParams): JsonValue {
    if (!Object.isNull(this.restartFailure))
      throw this.restartFailure;
    this.exit = null;
    this.restartSession(params.sessionId);
    return null;
  }

  private closeOwner(owner: string): JsonValue {
    for (const terminal of this.sessions.filter(t => t.owner === owner)) {
      this.sessions.splice(this.sessions.indexOf(terminal), 1);
      this.context.emit(TerminalNames.closedEvent, new TerminalReference(terminal.sessionId).toJson());
    }
    return null;
  }

  private restore(params: TerminalRestoreParams): JsonValue {
    this.size = params.size;
    this.sessions.push(...this.saved.splice(0));
    return null;
  }

  private async launchAsync(params: TerminalLaunchParams): Promise<JsonValue> {
    if (this.isHoldingOpens)
      await new Promise<void>(resolve => this.opens.push(resolve));
    if (!Object.isNull(this.openFailure))
      throw this.openFailure;
    if (!Object.isNull(params.shellId) && !this.shells.some(t => t.id === params.shellId))
      throw Object.assign(new Error(`The shell ${params.shellId} was not found.`), { code: FailureCode.NotFound });
    const folder: string = params.folder ?? "/home/a";
    if (this.missingFolders.has(folder))
      return new TerminalLaunched(null, folder).toJson();
    const sessionId: string = `launched-${++this.openedCount}`;
    this.addSession(sessionId, params.shellId ?? "bash", folder);
    return new TerminalLaunched(sessionId, null).toJson();
  }

  private async runAsync(params: TerminalRunParams): Promise<JsonValue> {
    if (this.isHoldingOpens)
      await new Promise<void>(resolve => this.opens.push(resolve));
    if (!Object.isNull(params.sessionId) && !this.sessions.some(t => t.sessionId === params.sessionId && t.owner === params.owner))
      return new TerminalRunResult(params.sessionId, TerminalRunOutcome.Ended).toJson();
    if (!Object.isNull(params.sessionId))
      return this.answerRun(params.sessionId);
    const free: TerminalSummary | undefined = this.sessions.findLast(t => t.owner === params.owner && this.freeSessions.has(t.sessionId));
    const sessionId: string = free?.sessionId ?? `run-${++this.openedCount}`;
    if (Object.isUndefined(free))
      this.addSession(sessionId, params.shellId ?? "bash", params.folder ?? "/home/a", null, false, false, params.owner, params.opensTab);
    if (!params.opensTab && this.announcesRuns)
      this.context.emit(TerminalNames.runOpenedEvent, new TerminalReference(sessionId).toJson());
    return this.answerRun(sessionId);
  }

  private answerRun(sessionId: string): JsonValue {
    const runId: string | null = this.runOutcome === TerminalRunOutcome.Typed ? `run-id-${++this.runCount}` : null;
    return new TerminalRunResult(sessionId, this.runOutcome, runId, Object.isNull(runId) ? [] : this.answerEnds).toJson();
  }

  private readRunOutput(parameters: JsonValue): JsonValue {
    TerminalRunOutputParams.fromJson(parameters);
    return this.runOutput?.toJson() ?? null;
  }

  private async openAsync(params: TerminalOpenParams): Promise<JsonValue> {
    if (this.isHoldingOpens)
      await new Promise<void>(resolve => this.opens.push(resolve));
    if (!Object.isNull(this.openFailure))
      throw this.openFailure;
    if (!Object.isNull(params.shellId) && !this.shells.some(t => t.id === params.shellId))
      throw Object.assign(new Error(`The shell ${params.shellId} was not found.`), { code: FailureCode.NotFound });
    const panel: TerminalSummary | undefined = params.isPanelTerminal ? this.sessions.findLast(t => t.isPanelTerminal) : undefined;
    if (!Object.isUndefined(panel))
      return new TerminalReference(panel.sessionId).toJson();
    const sessionId: string = `opened-${++this.openedCount}`;
    this.addSession(sessionId, params.shellId ?? "bash", params.folder ?? "/home/a", null, false, params.isPanelTerminal, params.owner);
    return new TerminalReference(sessionId).toJson();
  }
}
