/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";

import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonValue } from "@noldova/context.json";
import type { EventChannel, IModuleLog } from "@noldova/desktop.runtime";
import { EndedBy, Resources as ProtocolResources, TerminalAckParams, TerminalCommandAdded, TerminalCommandEnded, TerminalCompleteParams, TerminalCompletion, TerminalExit, TerminalExited, TerminalFindCommandsParams, TerminalInputParams, TerminalLaunched, TerminalLaunchParams, TerminalLinesParams, TerminalName, TerminalNames, TerminalOpenParams, TerminalOwnerReference, TerminalPaneReference, TerminalReference, TerminalResizeParams, TerminalRestartParams, TerminalRestoreParams, TerminalRunBusy, TerminalRunEnded, TerminalRunEndedBy, TerminalRunOutcome, TerminalRunOutputParams, TerminalRunParams, TerminalRunResult, TerminalSessions, TerminalShellKind, TerminalShells, TerminalShowOwnerParams, TerminalSize, TerminalVisibilityParams, WindowsPty, type TerminalAttachment, type TerminalLinePage, type TerminalMissingCommands, type TerminalRunOutput } from "@noldova/terminal.protocol";

import { AgentTerminalRestartException } from "../exceptions/agent-terminal-restart.exception.ts";
import { SystemRequirement } from "../enums/system-requirement.ts";
import { ConnectionClosingException } from "../exceptions/connection-closing.exception.ts";
import { DefaultShellNotFoundException } from "../exceptions/default-shell-not-found.exception.ts";
import { FolderNotFoundException } from "../exceptions/folder-not-found.exception.ts";
import { HostEndedException } from "../exceptions/host-ended.exception.ts";
import { SessionNotFoundException } from "../exceptions/session-not-found.exception.ts";
import { ShellKindNotFoundException } from "../exceptions/shell-kind-not-found.exception.ts";
import { ShellNotFoundException } from "../exceptions/shell-not-found.exception.ts";
import { UnknownMethodException } from "../exceptions/unknown-method.exception.ts";
import { UnsupportedSystemException } from "../exceptions/unsupported-system.exception.ts";
import type { IFileSystemReader } from "../interfaces/i-file-system-reader.ts";
import type { IPtyProcess } from "../interfaces/i-pty-process.ts";
import type { IPtySpawner } from "../interfaces/i-pty-spawner.ts";
import { HostedTerminal } from "../models/hosted-terminal.ts";
import type { MirrorLine } from "../models/mirror-line.ts";
import type { RequestClient } from "../models/request-client.ts";
import { SavedTerminal } from "../models/saved-terminal.ts";
import type { Shell } from "../models/shell.ts";
import type { ShellLaunch } from "../models/shell-launch.ts";
import { ShellOptionsReply } from "../models/shell-options-reply.ts";
import { StartedShell } from "../models/started-shell.ts";
import type { TerminalEvents } from "../models/terminal-events.ts";
import type { TerminalHistoryPaths } from "../models/terminal-history-paths.ts";
import { TerminalOpening } from "../models/terminal-opening.ts";
import { WaitingRun } from "../models/waiting-run.ts";
import { Resources } from "../resources.ts";
import { CommandHistory } from "./command-history.ts";
import type { CompletionSource } from "./completion-source.ts";
import { DeferredPtyProcess } from "./deferred-pty-process.ts";
import { FailureText } from "./failure-text.ts";
import type { LatestEnvironment } from "./latest-environment.ts";
import type { OutputLog } from "./output-log.ts";
import type { SavedTerminals } from "./saved-terminals.ts";
import type { ShellIntegration } from "./shell-integration.ts";
import type { ShellLocator } from "./shell-locator.ts";
import { SystemRequirements } from "./system-requirements.ts";
import { TerminalAudience } from "./terminal-audience.ts";
import type { TerminalHistoryFolder } from "./terminal-history-folder.ts";
import { TerminalSession } from "./terminal-session.ts";

export class TerminalHost {
  private readonly spawner: IPtySpawner;
  private readonly fileSystem: IFileSystemReader;
  private readonly integration: ShellIntegration;
  private readonly historyFolder: TerminalHistoryFolder;
  private readonly locator: ShellLocator;
  private readonly windowsPty: WindowsPty | null;
  private readonly environment: LatestEnvironment;
  private readonly homeFolder: string;
  private readonly log: IModuleLog;
  private readonly events: TerminalEvents;
  private readonly saved: SavedTerminals;
  private readonly completions: CompletionSource;
  private readonly sessions: Map<string, HostedTerminal> = new Map<string, HostedTerminal>();
  private readonly commandHistory: CommandHistory = new CommandHistory();
  private readonly disposals: Set<Promise<void>> = new Set<Promise<void>>();
  private readonly opens: Map<Promise<unknown>, TerminalOpening> = new Map<Promise<unknown>, TerminalOpening>();
  private readonly launches: Map<Promise<unknown>, RequestClient> = new Map<Promise<unknown>, RequestClient>();
  private readonly agentSessionOwners: Map<string, string> = new Map<string, string>();
  private readonly audience: TerminalAudience = new TerminalAudience();
  private readonly panelOpenings: Map<number, Promise<TerminalReference>> = new Map<number, Promise<TerminalReference>>();
  private hasEnded: boolean = false;
  private restoring: Promise<void> | null = null;
  private readonly appCloses: Set<Promise<void>> = new Set<Promise<void>>();
  private readonly closings: Map<(terminal: HostedTerminal | TerminalOpening) => boolean, PromiseWithResolvers<void>> =
    new Map<(terminal: HostedTerminal | TerminalOpening) => boolean, PromiseWithResolvers<void>>();
  private readonly closingConnections: Set<number> = new Set<number>();

  public constructor(
    spawner: IPtySpawner,
    fileSystem: IFileSystemReader,
    integration: ShellIntegration,
    historyFolder: TerminalHistoryFolder,
    locator: ShellLocator,
    platform: string,
    osRelease: string,
    environment: LatestEnvironment,
    homeFolder: string,
    log: IModuleLog,
    events: TerminalEvents,
    saved: SavedTerminals,
    completions: CompletionSource) {
    this.spawner = spawner;
    this.fileSystem = fileSystem;
    this.integration = integration;
    integration.onSuggestingChanged(t => {
      if (!t)
        this.commandHistory.clear();
    });
    this.historyFolder = historyFolder;
    this.locator = locator;
    this.windowsPty = platform === Resources.windowsPlatform
      ? new WindowsPty(TerminalHost.readWindowsBuild(osRelease))
      : null;
    this.environment = environment;
    this.homeFolder = homeFolder;
    this.log = log;
    this.events = events;
    this.saved = saved;
    this.completions = completions;
  }

  public async handleAsync(method: string, payload: JsonValue, client: RequestClient): Promise<JsonValue> {
    this.audience.see(client);
    switch (method) {
      case TerminalNames.shellsMethod:
        return new TerminalShells((await this.locator.locateAsync()).map(t => t.toTerminalShell())).toJson();
      case TerminalNames.openMethod:
        return (await this.openAsync(TerminalOpenParams.fromJson(payload), client)).toJson();
      case TerminalNames.closeMethod:
        await this.closeAsync(TerminalReference.fromJson(payload).sessionId, client);
        return null;
      case TerminalNames.restartMethod:
        await this.restartAsync(TerminalRestartParams.fromJson(payload), client);
        return null;
      case TerminalNames.sessionsMethod:
        return new TerminalSessions(this.terminals.filter(t => t.isReachedBy(client.connection, client.isApp))
          .map(t => t.session.toSummary(t.folder, t.ownerSessionId !== null, t.isPanelTerminal, t.owner, t.opensTab, t.name, t.shell.name))).toJson();
      case TerminalNames.attachMethod:
        return (await this.attachAsync(TerminalPaneReference.fromJson(payload), client)).toJson();
      case TerminalNames.inputMethod:
        this.input(TerminalInputParams.fromJson(payload), client);
        return null;
      case TerminalNames.resizeMethod:
        this.resize(TerminalResizeParams.fromJson(payload), client);
        return null;
      case TerminalNames.ackMethod:
        this.acknowledge(TerminalAckParams.fromJson(payload), client);
        return null;
      case TerminalNames.visibilityMethod:
        this.setVisible(TerminalVisibilityParams.fromJson(payload), client);
        return null;
      case TerminalNames.detachMethod:
        this.detach(TerminalPaneReference.fromJson(payload), client);
        return null;
      case TerminalNames.linesMethod:
        return (await this.readLinesAsync(TerminalLinesParams.fromJson(payload), client)).toJson();
      case TerminalNames.restoreMethod:
        await this.restoreAsync(TerminalRestoreParams.fromJson(payload), client);
        return null;
      case TerminalNames.closeOwnerMethod:
        await this.closeOwnerAsync(TerminalOwnerReference.fromJson(payload).owner, client);
        return null;
      case TerminalNames.launchMethod:
        return (await this.trackLaunchAsync(this.trackAsync(this.launchAsync(TerminalLaunchParams.fromJson(payload), client),
          new TerminalOpening(null, client.connection)), client)).toJson();
      case TerminalNames.runMethod: {
        const params: TerminalRunParams = TerminalRunParams.fromJson(payload);
        return (await this.runAfterClosesAsync(params, client)).toJson();
      }
      case TerminalNames.runOutputMethod:
        return (await this.readRunOutputAsync(TerminalRunOutputParams.fromJson(payload), client))?.toJson() ?? null;
      case TerminalNames.renameMethod:
        this.rename(TerminalName.fromJson(payload), client);
        return null;
      case TerminalNames.completeMethod:
        return (await this.completeAsync(TerminalCompleteParams.fromJson(payload), client)).toJson();
      case TerminalNames.findCommandsMethod:
        return (await this.findCommandsAsync(TerminalFindCommandsParams.fromJson(payload), client)).toJson();
      case TerminalNames.windowStartedMethod:
        if (client.window !== null) {
          this.detachLeftPanes(t => t.connection === client.connection && t.window === client.window && t.page !== client.page);
          await this.endLaunchesWithoutTabAsync(client.connection, client.window, client.page);
        }
        return null;
      case TerminalNames.showOwnerMethod: {
        const shown: TerminalShowOwnerParams = TerminalShowOwnerParams.fromJson(payload);
        this.audience.show(client, shown.owner, shown.isHidden);
        this.startUnshownShells();
        return null;
      }
      default:
        throw new UnknownMethodException(method);
    }
  }

  public async endAllAsync(): Promise<void> {
    this.hasEnded = true;
    for (const terminal of this.terminals) {
      terminal.cancelCommand();
      this.endRun(terminal, TerminalRunEndedBy.TerminalEnded, null);
    }
    const sessions: readonly TerminalSession[] = this.terminals.map(t => t.session);
    this.sessions.clear();
    await Promise.all(sessions.map(t => this.endAsync(t)));
    await Promise.all(this.disposals);
    await this.historyFolder.removeAsync();
    try {
      await this.integration.disposeAsync();
    }
    catch (error: unknown) {
      this.log.write(Resources.formatIntegrationRemovalFailed(FailureText.read(error)));
    }
  }

  public get terminals(): readonly HostedTerminal[] {
    return [...this.sessions.values()];
  }

  public findTerminal(sessionId: string): HostedTerminal | undefined {
    return this.sessions.get(sessionId);
  }

  public openTerminalAsync(shellId: string | null, folder: string, size: TerminalSize, ownerSessionId: string | null,
    storedLimit: number = ProtocolResources.defaultStoredLimit, note: string | null = null, isPanelTerminal: boolean = false,
    owner: string | null = null, client: RequestClient | null = null, sessionId: string = randomUUID(),
    environment: Readonly<Record<string, string>> | null = null, startsAtFit: boolean = false, opensTab: boolean = true): Promise<HostedTerminal> {
    return this.trackAsync(this.startTerminalAsync(shellId, folder, size, ownerSessionId, storedLimit, note, isPanelTerminal, owner, client, sessionId,
      environment, startsAtFit, opensTab), new TerminalOpening(owner, client?.connection ?? null));
  }

  public bindAgentSession(agentSessionId: string, owner: string): void {
    this.agentSessionOwners.set(agentSessionId, owner);
  }

  public unbindAgentSession(agentSessionId: string): void {
    this.agentSessionOwners.delete(agentSessionId);
  }

  public findAgentSessionOwner(agentSessionId: string): string | null {
    return this.agentSessionOwners.get(agentSessionId) ?? null;
  }

  public async spawnAsync(file: string, args: readonly string[] | string, folder: string, size: TerminalSize,
    environment: Readonly<Record<string, string>> = {}): Promise<IPtyProcess> {
    return this.spawnFromAsync(await this.readEnvironmentAsync(), file, args, folder, size, environment, false);
  }

  public async closeOwnerAsync(owner: string, client: RequestClient | null): Promise<void> {
    const isApp: boolean = client === null || client.isApp;
    if (isApp)
      for (const [agentSessionId, bound] of this.agentSessionOwners)
        if (bound === owner)
          this.agentSessionOwners.delete(agentSessionId);
    const isOwned = (terminal: HostedTerminal | TerminalOpening): boolean => terminal.owner === owner
      && (client === null || terminal.isReachedBy(client.connection, client.isApp));
    const closed: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    this.closings.set(isOwned, closed);
    try {
      for (const terminal of this.terminals.filter(isOwned))
        terminal.cancelCommand();
      await Promise.allSettled([this.restoring]);
      await this.settleOpensAsync(isOwned);
      this.ensureRunning();
      const owned: readonly HostedTerminal[] = this.terminals.filter(isOwned);
      if (isApp)
        this.saved.forgetOwner(owner);
      for (const terminal of owned) {
        this.sessions.delete(terminal.session.sessionId);
        terminal.cancelCommand();
        this.endRun(terminal, TerminalRunEndedBy.TerminalEnded, null);
        this.audience.publish(this.events.closed, terminal, new TerminalReference(terminal.session.sessionId).toJson());
      }
      await Promise.all(owned.map(t => this.endAsync(t.session)));
    }
    finally {
      this.closings.delete(isOwned);
      closed.resolve();
    }
  }

  public async closeConnectionAsync(connection: number, window: number | null): Promise<void> {
    const wasApp: boolean = this.audience.forget(connection, window);
    this.detachLeftPanes(t => t.connection === connection && (window === null || t.window === window));
    this.startUnshownShells();
    if (window !== null) {
      await this.endLaunchesWithoutTabAsync(connection, window, null);
      return;
    }
    const closing: Promise<void> = this.endConnectionAsync(connection, wasApp);
    if (wasApp)
      this.appCloses.add(closing);
    try {
      await closing;
    }
    finally {
      this.appCloses.delete(closing);
    }
  }

  public async closeTerminalAsync(sessionId: string): Promise<void> {
    const terminal: HostedTerminal | undefined = this.sessions.get(sessionId);
    if (terminal === undefined)
      return;
    this.sessions.delete(sessionId);
    terminal.cancelCommand();
    this.endRun(terminal, TerminalRunEndedBy.TerminalEnded, null);
    this.saved.forget(sessionId);
    if (terminal.owner !== null)
      this.audience.publish(this.events.closed, terminal, new TerminalReference(sessionId).toJson());
    if ((!await this.stopAsync(terminal.session) || terminal.heldExit !== null) && terminal.environment !== null) {
      terminal.isEndSent = true;
      this.audience.publish(this.events.exited, terminal, new TerminalExited(sessionId, new TerminalExit(null, EndedBy.Close)).toJson());
    }
    await this.disposeAsync(terminal.session);
  }

  private async startTerminalAsync(shellId: string | null, folder: string, size: TerminalSize, ownerSessionId: string | null, storedLimit: number,
    note: string | null, isPanelTerminal: boolean, owner: string | null, client: RequestClient | null, sessionId: string,
    environment: Readonly<Record<string, string>> | null, startsAtFit: boolean, opensTab: boolean): Promise<HostedTerminal> {
    const shell: Shell | undefined = await this.locator.findAsync(shellId);
    this.ensureRunning();
    if (shell === undefined)
      throw shellId === null ? new DefaultShellNotFoundException() : new ShellNotFoundException(shellId);
    const isFolder: boolean = await this.fileSystem.isFolderAsync(folder);
    this.ensureRunning();
    if (!isFolder)
      throw new FolderNotFoundException(folder);
    const historyPaths: TerminalHistoryPaths | null = await this.historyFolder.pathsAsync(sessionId);
    this.ensureRunning();
    const started: StartedShell = await this.startShellAsync(shell, folder, size, note, environment ?? {}, startsAtFit ? sessionId : null);
    const isKept: boolean = ownerSessionId === null && client?.isApp === true && environment === null;
    const publish: (channel: EventChannel, payload: JsonValue) => void = (channel, payload) => this.audience.publish(channel, terminal, payload);
    const terminal: HostedTerminal = new HostedTerminal(new TerminalSession(sessionId, shell.id, size, started.process, started.nonce, this.windowsPty, historyPaths, storedLimit, {
      onOutput: t => publish(this.events.output, t.toJson()),
      onExited: t => {
        this.endRun(terminal, TerminalRunEndedBy.TerminalEnded, null);
        if (terminal.isEndSent)
          return;
        if (terminal.isRestarting) {
          terminal.heldExit = t;
          return;
        }
        publish(this.events.exited, t.toJson());
        this.forgetOldestExited();
      },
      onTitleChanged: t => publish(this.events.titleChanged, t.toJson()),
      onCwdChanged: t => {
        if (isKept)
          this.saved.moveTo(t.sessionId, t.cwd);
        publish(this.events.cwdChanged, t.toJson());
      },
      onCommandEnded: t => {
        this.endLaunchCommand(terminal, t.exitCode);
        this.countRunEnd(terminal, t.exitCode, true);
      },
      onPromptStarted: () => {
        const offset: number | null = terminal.launchCommandOffset;
        if (offset !== null && terminal.session.text.readRange(offset, terminal.session.text.endOffset).includes(Resources.lineFeed))
          this.endLaunchCommand(terminal, null);
        this.countRunEnd(terminal, null, false);
      },
      onCommandStarted: t => this.addCommand(shell.id, t),
      onDetached: t => publish(this.events.detached, t.toJson()),
      onFailed: (id, message) => this.log.write(Resources.formatStartedCommandUnread(id, message))
    }, Resources.maximumAgentTextLength, shell.kind, ownerSessionId === null), shell, folder, ownerSessionId, isPanelTerminal, owner, client?.connection ?? null, environment);
    terminal.deferredShell = started.deferred;
    terminal.startTemporaryFolder = started.temporaryFolder;
    for (const line of started.printsNote ? [] : note?.split(Resources.lineBreaks) ?? [])
      terminal.session.writeNote(line);
    terminal.opensTab = opensTab;
    this.sessions.set(sessionId, terminal);
    if (isKept)
      this.saved.save(new SavedTerminal(sessionId, shell.id, folder, isPanelTerminal, owner, opensTab));
    else if (ownerSessionId !== null && owner !== null)
      this.audience.publish(this.events.opened, terminal,
        terminal.session.toSummary(folder, true, isPanelTerminal, owner, true, null, shell.name).toJson());
    return terminal;
  }

  private async endLaunchesWithoutTabAsync(connection: number, window: number, page: number | null): Promise<void> {
    await Promise.allSettled([...this.launches].filter(([, t]) => t.connection === connection && t.window === window).map(([t]) => t));
    await Promise.all(this.terminals
      .filter(t => t.connection === connection && t.launcher?.window === window && (page === null || t.launcher.page !== page))
      .map(t => this.closeTerminalAsync(t.session.sessionId)));
  }

  private trackLaunchAsync<TResult>(launching: Promise<TResult>, client: RequestClient): Promise<TResult> {
    this.launches.set(launching, client);
    const settled: () => void = () => void this.launches.delete(launching);
    void launching.then(settled, settled);
    return launching;
  }

  private async endConnectionAsync(connection: number, wasApp: boolean): Promise<void> {
    const isEnding = (terminal: HostedTerminal | TerminalOpening): boolean => terminal.connection === null ? wasApp && terminal.owner !== null
      : terminal.connection === connection;
    const closed: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    this.closings.set(isEnding, closed);
    this.closingConnections.add(connection);
    try {
      for (const terminal of this.terminals.filter(isEnding))
        terminal.cancelCommand();
      await Promise.allSettled([this.restoring]);
      await this.settleOpensAsync(isEnding);
      if (this.hasEnded)
        return;
      const ending: readonly HostedTerminal[] = this.terminals.filter(isEnding);
      for (const terminal of ending) {
        this.sessions.delete(terminal.session.sessionId);
        terminal.cancelCommand();
      }
      if (wasApp)
        this.restoring = null;
      await Promise.all(ending.map(t => this.endAsync(t.session)));
    }
    finally {
      this.closings.delete(isEnding);
      this.closingConnections.delete(connection);
      closed.resolve();
    }
  }

  private isClosing(terminal: HostedTerminal | TerminalOpening): boolean {
    return [...this.closings.keys()].some(isTheirs => isTheirs(terminal));
  }

  private endForClose(params: TerminalRunParams, client: RequestClient): TerminalRunResult | null {
    const closing: HostedTerminal | undefined = this.findClosing(params, client);
    return closing === undefined ? null : new TerminalRunResult(closing.session.sessionId, TerminalRunOutcome.Ended);
  }

  private findClosing(params: TerminalRunParams, client: RequestClient): HostedTerminal | undefined {
    return this.terminals.findLast(t => t.owner === params.owner && t.isReachedBy(client.connection, client.isApp) && this.isClosing(t));
  }

  private trackAsync<TResult>(opening: Promise<TResult>, place: TerminalOpening): Promise<TResult> {
    this.opens.set(opening, place);
    const settled: () => void = () => void this.opens.delete(opening);
    void opening.then(settled, settled);
    return opening;
  }

  private async settleOpensAsync(isTheirs: (opening: TerminalOpening) => boolean): Promise<void> {
    await Promise.allSettled([...this.opens].filter(([, t]) => isTheirs(t)).map(([t]) => t));
  }

  private async launchAsync(params: TerminalLaunchParams, client: RequestClient): Promise<TerminalLaunched> {
    if (params.folder !== null && !this.isAbsolute(params.folder))
      throw new ArgumentException(ProtocolResources.formatNotAbsolutePath(ProtocolResources.valueSubject), Resources.folderParameter);
    const folder: string = params.folder ?? this.homeFolder;
    const isFolder: boolean = await this.fileSystem.isFolderAsync(folder);
    this.ensureRunning();
    if (!isFolder)
      return new TerminalLaunched(null, folder);
    let shellId: string | null = params.shellId;
    if (params.shellKinds.length > 0) {
      const shell: Shell | undefined = await this.findShellOfKindsAsync(params.shellKinds, params.shellId);
      this.ensureRunning();
      if (shell === undefined)
        throw new ShellKindNotFoundException(params.shellKinds);
      shellId = shell.id;
    }
    const terminal: HostedTerminal = await this.startTerminalAsync(shellId, folder, params.size, null, params.storedLimit, params.notice, false,
      null, client, randomUUID(), params.environment, false, params.opensTab);
    if (!params.opensTab)
      terminal.launcher = client;
    if (params.command !== null)
      void this.typeCommandAsync(terminal, params.command).then(t => {
        terminal.launchCommandOffset = terminal.session.text.endOffset;
        if (t !== TerminalRunOutcome.Typed || !terminal.session.commands.hasMarks || terminal.session.commands.promptEndOffset === null || terminal.keyCount !== 0)
          this.endLaunchCommand(terminal, null);
      }).catch((error: unknown) => this.log.write(Resources.formatLaunchCommandFailed(terminal.session.sessionId, FailureText.read(error))));
    return new TerminalLaunched(terminal.session.sessionId, null);
  }

  private async typeCommandAsync(terminal: HostedTerminal, command: string, isPaste: boolean = false, waitsForFit: boolean = false): Promise<TerminalRunOutcome> {
    const session: TerminalSession = terminal.session;
    const typed: string = isPaste ? command.replace(Resources.leadingBlankLines, "") : command;
    const pending: AbortController = new AbortController();
    terminal.pendingCommand = pending;
    const signal: AbortSignal = pending.signal;
    const inputCount: number = terminal.inputCount;
    const keyCount: number = terminal.keyCount;
    if (waitsForFit) {
      await session.changes.waitUntilAsync(() => session.hasExited || terminal.isSized || terminal.deferredShell?.hasStarted !== false,
        Resources.paneFitWaitMilliseconds, signal);
      if (!signal.aborted && this.sessions.get(session.sessionId) === terminal)
        this.startShell(terminal);
    }
    const startedAt: number = Date.now();
    const isReady = (): boolean => session.hasIntegration ? session.commands.promptEndOffset !== null : session.receivedLength > 0;
    const isStarted = (): boolean => session.hasExited || isReady() || session.commands.isLoaded;
    if (await session.waitForStartAsync(isStarted, signal) && session.text.endOffset > 0)
      await session.changes.waitUntilAsync(isStarted, Resources.integrationWaitMilliseconds, signal);
    const deadline: number = startedAt + Resources.integrationWaitMilliseconds;
    while (!session.hasIntegration && !session.hasExited && Date.now() < deadline) {
      const length: number = session.receivedLength;
      await session.changes.waitUntilAsync(() => session.hasExited || session.receivedLength !== length, Resources.promptSettleMilliseconds, signal);
      if (session.receivedLength === length)
        break;
    }
    if (session.hasIntegration && session.commands.isLoaded)
      await session.changes.waitUntilAsync(() => session.hasExited || isReady(), Resources.shellStartMilliseconds, signal);
    const isEnded = (): boolean => signal.aborted || session.hasExited || this.sessions.get(session.sessionId) !== terminal || this.isClosing(terminal);
    const isBracketed: boolean = isPaste && !isEnded() && await session.isBracketedPasteAsync();
    const outcome: TerminalRunOutcome = isEnded() ? TerminalRunOutcome.Ended
      : isPaste && ((waitsForFit ? terminal.keyCount !== keyCount : terminal.inputCount !== inputCount) || session.commands.promptEndOffset !== null && session.readPromptLine() !== "") ? TerminalRunOutcome.Input
      : isPaste && !isBracketed && typed.includes(Resources.tabKey) ? TerminalRunOutcome.Tab
      : TerminalRunOutcome.Typed;
    if (outcome === TerminalRunOutcome.Typed) {
      const text: string = isPaste ? TerminalHost.toPaste(typed, isBracketed) : `${command}${Resources.enterKey}`;
      terminal.typedEnds = isBracketed || !isPaste ? 1 : text.split(Resources.enterKey).length - 1;
      terminal.paste = isBracketed ? typed.replace(Resources.whitespace, "") : "";
      if (isPaste)
        terminal.recordRunInput();
      session.write(text);
    }
    if (terminal.pendingCommand === pending)
      terminal.pendingCommand = null;
    return outcome;
  }

  private endLaunchCommand(terminal: HostedTerminal, exitCode: number | null): void {
    if (terminal.launchCommandOffset === null)
      return;
    terminal.launchCommandOffset = null;
    this.audience.publish(this.events.launchCommandEnded, terminal, new TerminalCommandEnded(terminal.session.sessionId, exitCode).toJson());
  }

  private static findEchoEnd(output: string, paste: string): number | null {
    const start: number = output.replace(Resources.whitespace, "").indexOf(paste);
    if (start < 0)
      return null;
    let index: number = 0;
    for (let count: number = 0; count < start + paste.length; index++)
      if (output.charAt(index).trim().length > 0)
        count++;
    return index;
  }

  private static toPaste(command: string, isBracketed: boolean): string {
    const text: string = command.replace(Resources.trailingLineBreaks, "").replace(Resources.pasteLineBreaks, Resources.enterKey);
    return isBracketed ? `${Resources.pasteStart}${text}${Resources.pasteEnd}${Resources.enterKey}` : `${text}${Resources.enterKey}`;
  }

  private async runAfterClosesAsync(params: TerminalRunParams, client: RequestClient): Promise<TerminalRunResult> {
    const place: TerminalOpening = new TerminalOpening(params.owner, client.connection);
    for (;;) {
      if (params.sessionId === null && this.isClosing(place)) {
        const closing: HostedTerminal | undefined = this.findClosing(params, client);
        if (closing !== undefined)
          return new TerminalRunResult(closing.session.sessionId, TerminalRunOutcome.Ended);
        if (this.closingConnections.has(client.connection))
          throw new ConnectionClosingException();
        await Promise.allSettled([...this.closings].filter(([isTheirs]) => isTheirs(place)).map(([, closed]) => closed.promise));
      }
      const result: TerminalRunResult | null = await this.trackAsync(this.runAsync(params, client), place);
      if (result !== null)
        return result;
    }
  }

  private async runAsync(params: TerminalRunParams, client: RequestClient): Promise<TerminalRunResult | null> {
    await Promise.allSettled([this.restoring]);
    this.ensureRunning();
    if (params.sessionId !== null) {
      const target: HostedTerminal | null = this.findRunTarget(params.sessionId, params, client);
      return target === null || this.isClosing(target) ? new TerminalRunResult(params.sessionId, TerminalRunOutcome.Ended)
        : this.runIntoAsync(params, target, client);
    }
    const place: TerminalOpening = new TerminalOpening(params.owner, client.connection);
    if (this.isClosing(place))
      return this.endForClose(params, client);
    const isCandidate = (t: HostedTerminal): boolean => t.owner === params.owner && t.isReachedBy(client.connection, client.isApp)
      && (params.shellKinds.length === 0 || params.shellKinds.includes(t.shell.kind)) && !t.isRunStarting;
    const newest: HostedTerminal | undefined = this.terminals.findLast(t => isCandidate(t) && (t.isFree || t.isDrawingPrompt));
    if (newest !== undefined && !newest.isFree)
      await this.waitForPromptAsync(newest);
    let terminal: HostedTerminal | undefined = this.terminals.findLast(t => isCandidate(t) && t.isFree);
    const isNew: boolean = terminal === undefined;
    if (terminal === undefined) {
      const shell: Shell | undefined = params.shellKinds.length === 0 ? await this.findFallbackShellAsync(params.shellId)
        : await this.findShellOfKindsAsync(params.shellKinds, params.shellId);
      if (shell === undefined && params.shellKinds.length > 0)
        return new TerminalRunResult(null, TerminalRunOutcome.NoShell);
      if (this.isClosing(place))
        return this.endForClose(params, client);
      terminal = await this.startForPersonAsync(new TerminalOpenParams(shell?.id ?? null, params.folder, params.size, params.storedLimit, false, params.owner),
        client, true, params.opensTab);
      if (this.isClosing(terminal))
        return new TerminalRunResult(terminal.session.sessionId, TerminalRunOutcome.Ended);
      if (!params.opensTab)
        terminal.fitWindow = client;
      this.audience.publish(this.events.opened, terminal,
        terminal.session.toSummary(terminal.folder, false, false, params.owner, terminal.opensTab, terminal.name, terminal.shell.name).toJson());
      this.startIfUnshown(terminal);
    }
    if (!params.opensTab)
      this.events.runOpened.publishTo(client.connection, client.window, new TerminalReference(terminal.session.sessionId).toJson());
    return this.typeRunAsync(terminal, params.command, client, isNew);
  }

  private async waitForPromptAsync(terminal: HostedTerminal): Promise<void> {
    const wasStarting: boolean = terminal.isRunStarting;
    terminal.isRunStarting = true;
    try {
      await terminal.session.changes.waitUntilAsync(() => !terminal.isDrawingPrompt, Resources.promptDrawWaitMilliseconds, terminal.beginInterrupt());
    }
    finally {
      terminal.endInterrupt();
      terminal.isRunStarting = wasStarting;
    }
  }

  private findRunTarget(sessionId: string, params: TerminalRunParams, client: RequestClient): HostedTerminal | null {
    const terminal: HostedTerminal | undefined = this.sessions.get(sessionId);
    return terminal === undefined || !terminal.isReachedBy(client.connection, client.isApp) || terminal.ownerSessionId !== null
      || terminal.owner !== params.owner || params.shellKinds.length > 0 && !params.shellKinds.includes(terminal.shell.kind) ? null : terminal;
  }

  private async runIntoAsync(params: TerminalRunParams, terminal: HostedTerminal, client: RequestClient): Promise<TerminalRunResult> {
    const session: TerminalSession = terminal.session;
    if (terminal.isRunStarting)
      return new TerminalRunResult(session.sessionId, TerminalRunOutcome.Busy);
    terminal.isRunStarting = true;
    try {
      const isBusy = (): boolean => !terminal.isFree && !session.hasExited && this.sessions.get(session.sessionId) === terminal
        && !this.isClosing(terminal);
      if (isBusy() && terminal.isDrawingPrompt) {
        await this.waitForPromptAsync(terminal);
        if (this.sessions.get(session.sessionId) !== terminal)
          return new TerminalRunResult(session.sessionId, TerminalRunOutcome.Ended);
      }
      if (isBusy() && params.whenBusy === TerminalRunBusy.Interrupt && terminal.pendingCommand === null) {
        const isStarted = (): boolean => isBusy() && session.commands.runningCommand !== null;
        const signal: AbortSignal = terminal.beginInterrupt();
        const deadline: number = Date.now() + Resources.runInterruptWaitMilliseconds;
        await session.changes.waitUntilAsync(() => !isBusy() || isStarted(), Resources.runInterruptWaitMilliseconds, signal);
        if (isStarted() && await TerminalHost.waitForCommandAsync(session, isStarted, deadline, signal)) {
          session.write(Resources.interruptKey);
          await session.changes.waitUntilAsync(() => !isBusy(), Resources.runInterruptWaitMilliseconds, signal);
        }
      }
      if (isBusy())
        return new TerminalRunResult(session.sessionId, TerminalRunOutcome.Busy);
      return await this.typeRunAsync(terminal, params.command, client);
    }
    finally {
      terminal.isRunStarting = false;
      terminal.endInterrupt();
    }
  }

  private static readWindowsBuild(osRelease: string): number {
    const build: number | null = SystemRequirements.readWindowsBuild(osRelease);
    if (build === null)
      throw new UnsupportedSystemException(SystemRequirement.WindowsBuild, osRelease);
    return build;
  }

  private static async waitForCommandAsync(session: TerminalSession, isStarted: () => boolean, deadline: number, signal: AbortSignal):
    Promise<boolean> {
    for (;;) {
      const group: number | null = await session.readForegroundProcessGroupAsync();
      if (!isStarted() || signal.aborted)
        return false;
      if (group !== session.pid)
        return true;
      if (Date.now() >= deadline)
        return false;
      await session.changes.waitUntilAsync(() => !isStarted(), Math.min(Resources.foregroundPollMilliseconds, deadline - Date.now()), signal);
    }
  }

  private async typeRunAsync(terminal: HostedTerminal, command: string, client: RequestClient, waitsForFit: boolean = false): Promise<TerminalRunResult> {
    const session: TerminalSession = terminal.session;
    const outcome: TerminalRunOutcome = await this.typeCommandAsync(terminal, command, true, waitsForFit);
    if (outcome !== TerminalRunOutcome.Typed)
      return new TerminalRunResult(session.sessionId, outcome);
    const runId: string = randomUUID();
    terminal.addRun(runId, session.anchorRunAsync());
    const ended: TerminalRunEnded[] = [];
    const previous: TerminalRunEnded | null = this.endRun(terminal, TerminalRunEndedBy.Command, terminal.waitingRun?.exitCode ?? null, client);
    if (previous !== null)
      ended.push(previous);
    if (session.commands.hasMarks && session.commands.promptEndOffset !== null)
      terminal.waitingRun = new WaitingRun(runId, client.connection, client.window, terminal.typedEnds, session.text.endOffset,
        terminal.paste);
    else
      ended.push(new TerminalRunEnded(session.sessionId, runId, TerminalRunEndedBy.NoIntegration, null));
    return new TerminalRunResult(session.sessionId, outcome, runId, ended);
  }

  private countRunEnd(terminal: HostedTerminal, exitCode: number | null, isEndMark: boolean): void {
    const run: WaitingRun | null = terminal.waitingRun;
    if (run === null)
      return;
    const text: OutputLog = terminal.session.text;
    const output: string = text.readRange(run.offset, text.endOffset);
    const echoEnd: number | null = run.paste.length === 0 ? 0 : TerminalHost.findEchoEnd(output, run.paste);
    if (!isEndMark && (run.isAfterEndMark || echoEnd === null || !output.slice(echoEnd).includes(Resources.lineFeed))) {
      run.isAfterEndMark = false;
      return;
    }
    run.isAfterEndMark = isEndMark;
    run.exitCode = exitCode;
    run.offset = text.endOffset;
    run.paste = "";
    run.remainingEnds--;
    if (run.remainingEnds === 0)
      this.endRun(terminal, TerminalRunEndedBy.Command, exitCode);
  }

  private endRun(terminal: HostedTerminal, endedBy: TerminalRunEndedBy, exitCode: number | null, answered: RequestClient | null = null):
    TerminalRunEnded | null {
    const run: WaitingRun | null = terminal.waitingRun;
    if (run === null)
      return null;
    terminal.waitingRun = null;
    const ended: TerminalRunEnded = new TerminalRunEnded(terminal.session.sessionId, run.runId, endedBy, endedBy === TerminalRunEndedBy.Command ? exitCode : null);
    if (answered !== null && answered.connection === run.connection && answered.window === run.window)
      return ended;
    this.events.runEnded.publishTo(run.connection, run.window, ended.toJson());
    return null;
  }

  private async readRunOutputAsync(params: TerminalRunOutputParams, client: RequestClient): Promise<TerminalRunOutput | null> {
    const terminal: HostedTerminal | undefined = this.sessions.get(params.sessionId);
    const runs: readonly (readonly [string, Promise<MirrorLine>])[] = terminal === undefined ? [] : [...terminal.runs];
    const index: number = runs.findIndex(([runId]) => runId === params.runId);
    const run: readonly [string, Promise<MirrorLine>] | undefined = runs[index];
    if (terminal === undefined || run === undefined || !client.isApp || !terminal.isReachedBy(client.connection, true) || terminal.ownerSessionId !== null
      || terminal.session.hasExited || terminal.isRestarting)
      return null;
    const next: readonly [string, Promise<MirrorLine>] | undefined = runs[index + 1];
    return terminal.session.readRunLinesAsync(await run[1], next === undefined ? null : await next[1], params.maximumLines);
  }

  private async findFallbackShellAsync(shellId: string | null): Promise<Shell | undefined> {
    return (shellId === null ? undefined : await this.locator.findAsync(shellId)) ?? await this.locator.findAsync(null);
  }

  private async findShellOfKindsAsync(kinds: readonly TerminalShellKind[], shellId: string | null): Promise<Shell | undefined> {
    const fallback: Shell | undefined = await this.findFallbackShellAsync(shellId);
    return fallback !== undefined && kinds.includes(fallback.kind) ? fallback : await this.locator.findKindAsync(kinds);
  }

  private openAsync(params: TerminalOpenParams, client: RequestClient): Promise<TerminalReference> {
    return this.trackAsync(this.openRequestedAsync(params, client), new TerminalOpening(params.owner, client.connection));
  }

  private async openRequestedAsync(params: TerminalOpenParams, client: RequestClient): Promise<TerminalReference> {
    if (!params.isPanelTerminal)
      return this.openForPersonAsync(params, client);
    await Promise.allSettled([this.restoring]);
    const panel: HostedTerminal | undefined = this.terminals.findLast(t => t.isPanelTerminal && t.isReachedBy(client.connection, client.isApp));
    if (panel !== undefined)
      return new TerminalReference(panel.session.sessionId);
    let opening: Promise<TerminalReference> | undefined = this.panelOpenings.get(client.connection);
    if (opening === undefined) {
      opening = this.openForPersonAsync(params, client).finally(() => {
        this.panelOpenings.delete(client.connection);
      });
      this.panelOpenings.set(client.connection, opening);
    }
    return opening;
  }

  private async openForPersonAsync(params: TerminalOpenParams, client: RequestClient): Promise<TerminalReference> {
    return new TerminalReference((await this.startForPersonAsync(params, client)).session.sessionId);
  }

  private async startForPersonAsync(params: TerminalOpenParams, client: RequestClient, startsAtFit: boolean = false,
    opensTab: boolean = true): Promise<HostedTerminal> {
    if (params.folder !== null && !this.isAbsolute(params.folder))
      throw new ArgumentException(ProtocolResources.formatNotAbsolutePath(ProtocolResources.valueSubject), Resources.folderParameter);
    const missing: string | null = params.folder !== null && !(await this.fileSystem.isFolderAsync(params.folder)) ? params.folder : null;
    this.ensureRunning();
    const folder: string = params.folder === null || missing !== null ? this.homeFolder : params.folder;
    const terminal: HostedTerminal = await this.openTerminalAsync(params.shellId, folder, params.size, null, params.storedLimit,
      missing === null ? null : Resources.formatStartFolderNote(missing), params.isPanelTerminal, params.owner, client, randomUUID(), null, startsAtFit,
      opensTab);
    if (missing !== null)
      this.log.write(Resources.formatStartFolderMissing(terminal.session.sessionId, missing, this.homeFolder));
    return terminal;
  }

  private async restoreAsync(params: TerminalRestoreParams, client: RequestClient): Promise<void> {
    if (!client.isApp)
      return;
    if (this.appCloses.size > 0) {
      await Promise.allSettled(this.appCloses);
      if (!this.audience.isApp(client.connection))
        return;
    }
    this.restoring ??= this.restoreSavedAsync(params, client);
    await this.restoring;
  }

  private async restoreSavedAsync(params: TerminalRestoreParams, client: RequestClient): Promise<void> {
    let saved: readonly SavedTerminal[];
    try {
      saved = this.saved.list();
    }
    catch (error: unknown) {
      this.log.write(Resources.formatSavedTerminalsUnreadable(FailureText.read(error)));
      return;
    }
    const panel: SavedTerminal | undefined = saved.findLast(t => t.isPanelTerminal);
    const restoring: SavedTerminal[] = [];
    for (const terminal of saved) {
      if (this.sessions.has(terminal.sessionId))
        continue;
      if (terminal.isPanelTerminal && (terminal !== panel || this.panelOpenings.has(client.connection)
        || this.terminals.some(t => t.isPanelTerminal && t.connection === client.connection)))
        this.saved.forget(terminal.sessionId);
      else
        restoring.push(terminal);
    }
    await Promise.all(restoring.map(t => this.restoreOrForgetAsync(t, params, client)));
    for (const terminal of restoring) {
      const hosted: HostedTerminal | undefined = this.sessions.get(terminal.sessionId);
      if (hosted !== undefined) {
        this.sessions.delete(terminal.sessionId);
        this.sessions.set(terminal.sessionId, hosted);
      }
    }
  }

  private async restoreOrForgetAsync(saved: SavedTerminal, params: TerminalRestoreParams, client: RequestClient): Promise<void> {
    try {
      await this.restoreTerminalAsync(saved, params, client);
    }
    catch (error: unknown) {
      this.ensureRunning();
      this.saved.forget(saved.sessionId);
      this.log.write(Resources.formatRestoreFailed(saved.sessionId, FailureText.read(error)));
    }
  }

  private async restoreTerminalAsync(saved: SavedTerminal, params: TerminalRestoreParams, client: RequestClient): Promise<void> {
    const hasShell: boolean = await this.locator.findAsync(saved.shellId) !== undefined;
    const fallback: string | null = params.shellId !== null && await this.locator.findAsync(params.shellId) !== undefined ? params.shellId : null;
    const hasFolder: boolean = this.isAbsolute(saved.folder) && await this.fileSystem.isFolderAsync(saved.folder);
    this.ensureRunning();
    const note: string | null = hasShell
      ? hasFolder ? null : Resources.formatStartFolderNote(saved.folder)
      : hasFolder ? Resources.formatRestoredShellNote(saved.shellId) : Resources.formatRestoredShellAndFolderNote(saved.shellId, saved.folder);
    const terminal: HostedTerminal = await this.openTerminalAsync(hasShell ? saved.shellId : fallback, hasFolder ? saved.folder : this.homeFolder,
      params.size, null, params.storedLimit, note, saved.isPanelTerminal, saved.owner, client, saved.sessionId, null, false, saved.opensTab);
    const name: string | null = saved.name;
    terminal.name = name !== null && name.trim() !== "" && name.length <= ProtocolResources.maximumTitleLength ? name : null;
    if (!hasShell)
      this.log.write(Resources.formatRestoredShellMissing(saved.sessionId, saved.shellId));
    if (!hasFolder)
      this.log.write(Resources.formatStartFolderMissing(saved.sessionId, saved.folder, this.homeFolder));
  }

  private toVariableKey(name: string): string {
    return this.windowsPty === null ? name : name.toUpperCase();
  }

  private isAbsolute(folder: string): boolean {
    return this.windowsPty === null ? folder.startsWith(Resources.posixRoot) : Resources.windowsAbsolutePath.test(folder);
  }

  private async closeAsync(sessionId: string, client: RequestClient): Promise<void> {
    this.find(sessionId, client);
    await this.closeTerminalAsync(sessionId);
  }

  private rename(name: TerminalName, client: RequestClient): void {
    const terminal: HostedTerminal = this.findHosted(name.sessionId, client);
    terminal.name = name.name;
    this.saved.rename(name.sessionId, name.name);
    this.audience.publish(this.events.renamed, terminal, name.toJson());
  }

  private async completeAsync(params: TerminalCompleteParams, client: RequestClient): Promise<TerminalCompletion> {
    const terminal: HostedTerminal = this.findHosted(params.sessionId, client);
    const keys: string | undefined = params.asksShell && this.completions.followsCommand(terminal.shell.kind, params.line, params.cursor)
      ? Resources.optionsKeys.get(terminal.shell.kind) : undefined;
    const [completion, reply] = await Promise.all([
      this.completions.completeAsync(params.sessionId, terminal.shell.kind, params.line, params.cursor, terminal.session.cwd ?? terminal.folder,
        this.readCompletionEnvironment(terminal), terminal.session.shellNames, terminal.session.shellBuiltins),
      keys === undefined ? Promise.resolve(ShellOptionsReply.none) : terminal.session.askOptionsAsync(keys)
    ]);
    if (reply.isTimedOut)
      return new TerminalCompletion(params.cursor, [], true);
    return reply.options === null ? completion
      : this.completions.addOptions(completion, terminal.shell.kind, params.line, params.cursor, reply.options);
  }

  private async findCommandsAsync(params: TerminalFindCommandsParams, client: RequestClient): Promise<TerminalMissingCommands> {
    const terminal: HostedTerminal = this.findHosted(params.sessionId, client);
    const shellNames: ReadonlySet<string> | null = terminal.session.isShellPathReset || terminal.session.isShellModulePathReset ? null
      : terminal.session.shellNames;
    const environment: Readonly<Record<string, string>> = this.readCompletionEnvironment(terminal);
    return terminal.shell.kind === TerminalShellKind.PowerShell
      ? this.completions.findMissingPowerShellAsync(terminal.session.commands, terminal.shell.file, params.names, shellNames, environment)
      : this.completions.findMissingAsync(params.sessionId, terminal.session.commands, terminal.session.prompts, terminal.shell.kind,
        terminal.session.cwd ?? terminal.folder, params.names, shellNames, environment);
  }

  private readCompletionEnvironment(terminal: HostedTerminal): Readonly<Record<string, string>> {
    const replaced: Record<string, string> = {};
    if (terminal.session.shellPath !== null)
      replaced[Resources.pathVariable] = terminal.session.shellPath;
    if (terminal.session.shellModulePath !== null)
      replaced[Resources.modulePathVariable] = terminal.session.shellModulePath;
    const temporaryFolder: string | null = terminal.session.shellTemporaryFolder ?? terminal.startTemporaryFolder;
    if (temporaryFolder !== null)
      replaced[Resources.temporaryFolderVariable] = temporaryFolder;
    const keys: ReadonlySet<string> = new Set(Object.keys(replaced).map(t => this.toVariableKey(t)));
    return this.withVariables(TerminalHost.toTerminalEnvironment(this.environment.read()), {
      ...Object.fromEntries(Object.entries(terminal.environment ?? {}).filter(([t]) => !keys.has(this.toVariableKey(t)))),
      ...replaced
    });
  }

  private async restartAsync(params: TerminalRestartParams, client: RequestClient): Promise<void> {
    const sessionId: string = params.sessionId;
    const terminal: HostedTerminal = this.findHosted(sessionId, client);
    if (terminal.ownerSessionId !== null)
      throw new AgentTerminalRestartException(sessionId);
    const restart: Promise<void> = terminal.restarts.then(() => this.restartNowAsync(sessionId, terminal, params.size));
    terminal.restarts = restart.then(() => undefined, () => undefined);
    await restart;
  }

  private async restartNowAsync(sessionId: string, terminal: HostedTerminal, size: TerminalSize): Promise<void> {
    if (this.sessions.get(sessionId) !== terminal)
      throw new SessionNotFoundException(sessionId);
    terminal.cancelCommand();
    this.endLaunchCommand(terminal, null);
    this.endRun(terminal, TerminalRunEndedBy.TerminalEnded, null);
    terminal.isRestarting = true;
    try {
      const session: TerminalSession = terminal.session;
      if (!session.hasExited && !await session.endAsync())
        this.log.write(Resources.formatShellLeftRunning(sessionId, session.pid));
      const started: StartedShell = await this.startShellAsync(terminal.shell, terminal.folder, size, null, terminal.environment ?? {});
      if (this.sessions.get(sessionId) !== terminal) {
        if (!await started.process.endAsync())
          this.log.write(Resources.formatLateShellLeftRunning(started.process.pid));
        throw new SessionNotFoundException(sessionId);
      }
      session.restart(started.process, started.nonce, size);
      terminal.startTemporaryFolder = started.temporaryFolder;
      terminal.clearRuns();
      terminal.heldExit = null;
    }
    finally {
      terminal.isRestarting = false;
      this.sendHeldExit(sessionId, terminal);
    }
    this.audience.publish(this.events.restarted, terminal, new TerminalReference(sessionId).toJson());
  }

  private sendHeldExit(sessionId: string, terminal: HostedTerminal): void {
    const exited: TerminalExited | null = terminal.heldExit;
    terminal.heldExit = null;
    if (exited === null || this.sessions.get(sessionId) !== terminal)
      return;
    this.audience.publish(this.events.exited, terminal, exited.toJson());
    this.forgetOldestExited();
  }

  private forgetOldestExited(): void {
    const exited: readonly HostedTerminal[] = this.terminals.filter(t => t.session.hasExited && !t.isRestarting);
    for (const terminal of exited.slice(0, Math.max(exited.length - Resources.maximumExitedSessions, 0))) {
      this.sessions.delete(terminal.session.sessionId);
      this.saved.forget(terminal.session.sessionId);
      const disposal: Promise<void> = this.disposeAsync(terminal.session);
      this.disposals.add(disposal);
      void disposal.then(() => this.disposals.delete(disposal), (error: unknown) => {
        this.disposals.delete(disposal);
        this.log.write(Resources.formatEndedTerminalDisposalFailed(terminal.session.sessionId, FailureText.read(error)));
      });
    }
  }

  private readLinesAsync(params: TerminalLinesParams, client: RequestClient): Promise<TerminalLinePage> {
    return this.find(params.sessionId, client).readLinesAsync(params.start, params.limit);
  }

  private addCommand(shellId: string, command: string): void {
    if (!this.isSuggesting())
      return;
    this.commandHistory.add(shellId, command);
    for (const terminal of this.sessions.values())
      if (terminal.shell.id === shellId && terminal.ownerSessionId === null)
        this.audience.publish(this.events.commandAdded, terminal, new TerminalCommandAdded(terminal.session.sessionId, command).toJson());
  }

  private async attachAsync(reference: TerminalPaneReference, client: RequestClient): Promise<TerminalAttachment> {
    const terminal: HostedTerminal = this.findHosted(reference.sessionId, client);
    terminal.paneClients.set(reference.paneId, client);
    const attachment: TerminalAttachment = await terminal.session.attachAsync(reference.paneId, terminal.ownerSessionId === null && this.isSuggesting()
      ? this.commandHistory.list(terminal.shell.id) : []);
    if (!terminal.paneClients.has(reference.paneId))
      terminal.session.detach(reference.paneId);
    return attachment;
  }

  private isSuggesting(): boolean {
    return this.integration.isSuggesting();
  }

  private input(params: TerminalInputParams, client: RequestClient): void {
    const terminal: HostedTerminal = this.findHosted(params.sessionId, client);
    const isReply: boolean = Resources.terminalReplies.test(params.data);
    terminal.recordInput(isReply, params.data);
    if (!isReply)
      terminal.keyCount++;
    terminal.session.write(params.data, !isReply);
  }

  private resize(params: TerminalResizeParams, client: RequestClient): void {
    const terminal: HostedTerminal = this.findHosted(params.sessionId, client);
    if (!terminal.session.resize(params.size))
      terminal.deferredShell?.start();
    terminal.isSized = true;
    terminal.session.changes.notify();
  }

  private acknowledge(params: TerminalAckParams, client: RequestClient): void {
    this.reachable(params.sessionId, client)?.session.acknowledge(params.paneId, params.offset);
  }

  private setVisible(params: TerminalVisibilityParams, client: RequestClient): void {
    this.find(params.sessionId, client).setVisible(params.paneId, params.isVisible);
  }

  private detach(reference: TerminalPaneReference, client: RequestClient): void {
    const terminal: HostedTerminal | null = this.reachable(reference.sessionId, client);
    terminal?.paneClients.delete(reference.paneId);
    terminal?.session.detach(reference.paneId);
    if (terminal !== null && !terminal.isSized)
      this.startShell(terminal);
  }

  private detachLeftPanes(isLeft: (client: RequestClient) => boolean): void {
    for (const terminal of this.terminals) {
      const left: readonly string[] = [...terminal.paneClients].filter(([, t]) => isLeft(t)).map(([t]) => t);
      for (const paneId of left) {
        terminal.paneClients.delete(paneId);
        terminal.session.detach(paneId);
      }
      if (left.length > 0 && !terminal.isSized)
        this.startShell(terminal);
    }
  }

  private startUnshownShells(): void {
    for (const terminal of this.terminals)
      this.startIfUnshown(terminal);
  }

  private startIfUnshown(terminal: HostedTerminal): void {
    if (terminal.isSized)
      return;
    const fitWindow: RequestClient | null = terminal.fitWindow;
    if (fitWindow === null ? !terminal.opensTab || !this.audience.shows(terminal) : !this.audience.isOpen(fitWindow) || this.audience.isHidden(fitWindow))
      this.startShell(terminal);
  }

  private startShell(terminal: HostedTerminal): void {
    if (terminal.deferredShell === null || terminal.deferredShell.hasStarted)
      return;
    terminal.deferredShell.start();
    terminal.session.changes.notify();
  }

  private find(sessionId: string, client: RequestClient): TerminalSession {
    return this.findHosted(sessionId, client).session;
  }

  private findHosted(sessionId: string, client: RequestClient): HostedTerminal {
    const terminal: HostedTerminal | null = this.reachable(sessionId, client);
    if (terminal === null)
      throw new SessionNotFoundException(sessionId);
    return terminal;
  }

  private reachable(sessionId: string, client: RequestClient): HostedTerminal | null {
    const terminal: HostedTerminal | undefined = this.sessions.get(sessionId);
    return terminal === undefined || !terminal.isReachedBy(client.connection, client.isApp) ? null : terminal;
  }

  private async endAsync(session: TerminalSession): Promise<void> {
    await this.stopAsync(session);
    await this.disposeAsync(session);
  }

  private async stopAsync(session: TerminalSession): Promise<boolean> {
    const hasEnded: boolean = await session.endAsync();
    if (!hasEnded)
      this.log.write(Resources.formatShellLeftRunning(session.sessionId, session.pid));
    return hasEnded;
  }

  private async disposeAsync(session: TerminalSession): Promise<void> {
    for (const failure of await session.disposeAsync())
      this.log.write(Resources.formatStoredLinesRemovalFailed(session.sessionId, FailureText.read(failure)));
  }

  private ensureRunning(): void {
    if (this.hasEnded)
      throw new HostEndedException();
  }

  private async spawnFromAsync(base: Readonly<Record<string, string>>, file: string, args: readonly string[] | string, folder: string,
    size: TerminalSize, environment: Readonly<Record<string, string>>, inheritCursor: boolean): Promise<IPtyProcess> {
    const process: IPtyProcess = await this.spawner.spawnAsync(file, args, folder, size.columns, size.rows, { ...base, ...environment }, inheritCursor);
    if (this.hasEnded) {
      if (!await process.endAsync())
        this.log.write(Resources.formatLateShellLeftRunning(process.pid));
      throw new HostEndedException();
    }
    return process;
  }

  private async startShellAsync(shell: Shell, folder: string, size: TerminalSize, note: string | null,
    variables: Readonly<Record<string, string>>, deferredSessionId: string | null = null): Promise<StartedShell> {
    const environment: Readonly<Record<string, string>> = this.withVariables(await this.readEnvironmentAsync(), variables);
    const printedNote: string | null = note === null || this.windowsPty === null ? null
      : note.split(Resources.lineBreaks).map(t => TerminalSession.toNote(t)).join("");
    const launch: ShellLaunch = await this.integration.prepareAsync(shell, randomUUID().replaceAll(Resources.terminalHostUuidSeparator, ""), environment, printedNote);
    const inheritsCursor: boolean = note !== null && !launch.printsNote;
    let process: IPtyProcess;
    let deferred: DeferredPtyProcess | null = null;
    try {
      this.ensureRunning();
      if (deferredSessionId === null)
        process = await this.spawnFromAsync(environment, launch.file, launch.args, folder, size, launch.environment, inheritsCursor);
      else {
        deferred = new DeferredPtyProcess(async (columns, rows) => {
          try {
            return await this.spawnFromAsync(environment, launch.file, launch.args, folder, new TerminalSize(columns, rows), launch.environment,
              inheritsCursor);
          }
          catch (error: unknown) {
            this.log.write(Resources.formatDeferredShellNotStarted(deferredSessionId, FailureText.read(error)));
            throw error;
          }
        }, size.columns, size.rows);
        process = deferred;
      }
    }
    catch (error: unknown) {
      await this.integration.removeNonceFileAsync(launch.nonceFile);
      throw error;
    }
    this.integration.watch(process, launch);
    const temporaryKey: string = this.toVariableKey(Resources.temporaryFolderVariable);
    return new StartedShell(process, launch.nonce, launch.printsNote, deferred,
      Object.entries(environment).find(([t]) => this.toVariableKey(t) === temporaryKey)?.[1] ?? null);
  }

  private withVariables(environment: Readonly<Record<string, string>>, variables: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
    const names: ReadonlySet<string> = new Set(Object.keys(variables).map(t => this.toVariableKey(t)));
    return Object.fromEntries([
      ...Object.entries(environment).filter(([t]) => !names.has(this.toVariableKey(t))),
      ...Object.entries(variables)]);
  }

  private async readEnvironmentAsync(): Promise<Readonly<Record<string, string>>> {
    const environment: Readonly<Record<string, string | undefined>> = await this.environment.readAsync();
    this.ensureRunning();
    return TerminalHost.toTerminalEnvironment(environment);
  }

  private static toTerminalEnvironment(environment: Readonly<Record<string, string | undefined>>): Readonly<Record<string, string>> {
    const terminalEnvironment: Record<string, string> = {};
    for (const [name, value] of Object.entries(environment)) {
      if (value !== undefined && !Resources.hostVariables.includes(name.toUpperCase()))
        terminalEnvironment[name] = value;
    }
    terminalEnvironment[Resources.termVariable] = Resources.terminalName;
    terminalEnvironment[Resources.colorTermVariable] = Resources.colorTerm;
    return terminalEnvironment;
  }
}
