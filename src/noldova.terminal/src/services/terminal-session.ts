/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ForegroundProcess } from "@noldova/desktop.runtime";
import { EndedBy, Resources as ProtocolResources, TerminalAttachment, TerminalCommandEnded, TerminalCwd, TerminalExit, TerminalExited, TerminalInputEdge, TerminalInputMark, TerminalOutput, TerminalPaneReference, TerminalReference, TerminalShellKind, TerminalSize, TerminalSummary, TerminalTitle, type TerminalLinePage, type TerminalRunOutput, type WindowsPty } from "@noldova/terminal.protocol";

import { MarkKind } from "../enums/mark-kind.ts";
import type { IPtyProcess } from "../interfaces/i-pty-process.ts";
import type { ITerminalSessionListener } from "../interfaces/i-terminal-session-listener.ts";
import type { MirrorLine } from "../models/mirror-line.ts";
import type { MirrorSnapshot } from "../models/mirror-snapshot.ts";
import { ShellMark } from "../models/shell-mark.ts";
import { ShellOptionsReply } from "../models/shell-options-reply.ts";
import type { TerminalHistoryPaths } from "../models/terminal-history-paths.ts";
import type { TrackedCommand } from "../models/tracked-command.ts";
import { TypedLine } from "../models/typed-line.ts";
import { Resources } from "../resources.ts";
import { ChangeSignal } from "./change-signal.ts";
import { CommandTracker } from "./command-tracker.ts";
import { FailureText } from "./failure-text.ts";
import { FlowController } from "./flow-controller.ts";
import { MarkScanner } from "./mark-scanner.ts";
import { OutputBatcher } from "./output-batcher.ts";
import { OutputLog } from "./output-log.ts";
import { PseudoTerminal } from "./pseudo-terminal.ts";
import { ResizeWakeup } from "./resize-wakeup.ts";
import { ShellOptionsQueue } from "./shell-options-queue.ts";
import { TerminalHistory } from "./terminal-history.ts";
import { TerminalMirror } from "./terminal-mirror.ts";

export class TerminalSession {
  private readonly listener: ITerminalSessionListener;
  private readonly windowsPty: WindowsPty | null;
  private readonly history: TerminalHistory;
  private readonly mirror: TerminalMirror;
  private readonly batcher: OutputBatcher;
  private readonly flow: FlowController;
  private readonly wakeup: ResizeWakeup | null;
  private readonly marksInput: boolean;
  private readonly shellKind: TerminalShellKind;
  private terminal: PseudoTerminal;
  private scanner: MarkScanner | null;
  private size: TerminalSize;
  private exit: TerminalExit | null = null;
  private isClosing: boolean = false;
  private receivedOffset: number = 0;
  private reportedCwd: string | null = null;
  private readonly typedLines: Set<TypedLine> = new Set<TypedLine>();
  private readonly restartOffsets: number[] = [];
  private readonly options: ShellOptionsQueue = new ShellOptionsQueue();
  private isPromptNew: boolean = false;
  private hasAnsweredOptions: boolean = false;
  private readonly disposal: AbortController = new AbortController();

  public readonly sessionId: string;
  public readonly shellId: string;
  public commands: CommandTracker = this.trackCommands();
  public readonly text: OutputLog;
  public readonly changes: ChangeSignal = new ChangeSignal();
  public hasIntegration: boolean;
  public promptLine: Promise<MirrorLine> | null = null;

  public constructor(
    sessionId: string,
    shellId: string,
    size: TerminalSize,
    process: IPtyProcess,
    nonce: string | null,
    windowsPty: WindowsPty | null,
    historyPaths: TerminalHistoryPaths | null,
    storedLimit: number,
    listener: ITerminalSessionListener,
    textLimit: number,
    shellKind: TerminalShellKind,
    marksInput: boolean) {
    this.sessionId = sessionId;
    this.shellKind = shellKind;
    this.marksInput = marksInput;
    this.shellId = shellId;
    this.size = size;
    this.windowsPty = windowsPty;
    this.scanner = nonce === null ? null : new MarkScanner(nonce);
    this.hasIntegration = nonce !== null;
    this.listener = listener;
    this.text = new OutputLog(textLimit);
    this.text.subscribe(t => {
      for (const line of this.typedLines)
        line.read(t);
    });
    this.history = new TerminalHistory(historyPaths, storedLimit, () => this.flow.acknowledgeStoring(this.history.backlog));
    this.mirror = new TerminalMirror(size, this.history, {
      onReply: t => this.terminal.answer(t),
      onParsed: t => this.flow.acknowledgeMirror(t, this.history.backlog),
      onTitleChanged: t => this.listener.onTitleChanged(new TerminalTitle(this.sessionId, t))
    });
    this.batcher = new OutputBatcher({
      onBatch: (offset, data, inputs) => this.listener.onOutput(new TerminalOutput(this.sessionId, offset, data, this.history.stored, inputs))
    });
    this.flow = new FlowController({
      onPause: () => this.terminal.pause(),
      onResume: () => this.terminal.resume(),
      onStalled: t => this.listener.onDetached(new TerminalPaneReference(this.sessionId, t))
    });
    this.wakeup = windowsPty !== null && shellKind === TerminalShellKind.Bash ? new ResizeWakeup(t => this.terminal.write(t)) : null;
    this.terminal = this.startTerminal(process);
  }

  public get pid(): number | null {
    return this.terminal.pid;
  }

  public readForegroundProcessAsync(): Promise<ForegroundProcess | null> {
    return this.terminal.readForegroundProcessAsync();
  }

  public get title(): string {
    return this.mirror.title;
  }

  public get cwd(): string | null {
    return this.reportedCwd;
  }

  public get shellPath(): string | null {
    return this.commands.path;
  }

  public get shellTemporaryFolder(): string | null {
    return this.commands.temporaryFolder;
  }

  public get shellModulePath(): string | null {
    return this.commands.modulePath;
  }

  public get shellNames(): ReadonlySet<string> | null {
    return this.commands.names;
  }

  public get shellBuiltins(): ReadonlySet<string> | null {
    return this.commands.builtins;
  }

  public get isShellPathReset(): boolean {
    return this.commands.isPathReset;
  }

  public get isShellModulePathReset(): boolean {
    return this.commands.isModulePathReset;
  }

  public get prompts(): number {
    return this.commands.prompts;
  }

  public get run(): number {
    return this.restartOffsets.length;
  }

  public endOfRun(run: number): number | null {
    return this.restartOffsets[run] ?? null;
  }

  public get hasExited(): boolean {
    return this.exit !== null;
  }

  public get receivedLength(): number {
    return this.receivedOffset;
  }

  public write(data: string, isKey: boolean = true): void {
    if (isKey)
      this.options.cancel();
    this.beforeInput();
    for (let lines = data.replace(Resources.bracketedPastes, "").split(Resources.lineBreaks).length - 1; lines > 0; lines--)
      this.commands.enterLine();
    this.terminal.write(data);
  }

  public typeLine(text: string): TypedLine {
    const line: TypedLine = new TypedLine(this.text.endOffset, text);
    this.typedLines.add(line);
    this.write(text + Resources.enterKey);
    return line;
  }

  public async waitForStartAsync(isStarted: () => boolean, signal: AbortSignal): Promise<boolean> {
    const startedAt: number = Date.now();
    await this.changes.waitUntilAsync(isStarted, Resources.integrationWaitMilliseconds, signal);
    if (!this.hasIntegration || isStarted() || this.text.endOffset > 0)
      return false;
    await this.changes.waitUntilAsync(() => isStarted() || this.text.endOffset > 0,
      Math.max(0, Resources.shellStartMilliseconds - (Date.now() - startedAt)), signal);
    return true;
  }

  public async askOptionsAsync(keys: string): Promise<ShellOptionsReply> {
    if (!this.hasIntegration || !this.commands.hasOptionsBinding || !this.commands.isWaitingAtPrompt || this.commands.runningCommand !== null
      || this.exit !== null)
      return ShellOptionsReply.none;
    const reply: Promise<ShellOptionsReply> = this.options.askAsync(this.hasAnsweredOptions ? Resources.optionsMilliseconds
      : Resources.firstOptionsMilliseconds);
    this.beforeInput();
    this.terminal.write(keys);
    const answered: ShellOptionsReply = await reply;
    if (answered.isTimedOut)
      this.write(Resources.tabKey);
    return answered;
  }

  public isBracketedPasteAsync(): Promise<boolean> {
    return this.mirror.isBracketedPasteAsync();
  }

  public readPromptLine(): string | null {
    const promptEnd: number | null = this.commands.promptEndOffset;
    if (promptEnd === null || this.commands.runningCommand !== null)
      return null;
    return this.text.readSince(promptEnd).text.trim();
  }

  public resize(size: TerminalSize): boolean {
    if (size.equals(this.size))
      return false;
    this.size = size;
    this.terminal.resize(size);
    this.watchResize();
    this.mirror.resize(size);
    return true;
  }

  public async attachAsync(paneId: string, commands: readonly string[]): Promise<TerminalAttachment> {
    const snapshot: MirrorSnapshot = await this.mirror.snapshotAsync();
    this.flow.attach(paneId, snapshot.offset);
    if (this.exit === null)
      this.redraw();
    return new TerminalAttachment(this.sessionId, snapshot.snapshot, snapshot.pending, snapshot.offset, this.size, this.mirror.title, this.cwd, this.exit, this.windowsPty,
      this.history.stored, snapshot.input, this.marksInput ? commands : [], this.shellKind);
  }

  public anchorRunAsync(): Promise<MirrorLine> {
    const prompt: Promise<MirrorLine> | null = this.promptLine;
    return prompt === null ? this.mirror.anchorAsync(null) : prompt.then(t => this.mirror.anchorAsync(t));
  }

  public readRunLinesAsync(start: MirrorLine, end: MirrorLine | null, maximum: number): Promise<TerminalRunOutput> {
    return this.mirror.readLinesAsync(start, end, maximum);
  }

  public readLinesAsync(start: number, limit: number): Promise<TerminalLinePage> {
    return this.history.readAsync(start, limit);
  }

  public acknowledge(paneId: string, offset: number): void {
    this.flow.acknowledge(paneId, offset);
  }

  public setVisible(paneId: string, isVisible: boolean): void {
    this.flow.setVisible(paneId, isVisible);
  }

  public detach(paneId: string): void {
    this.flow.detach(paneId);
  }

  public async endAsync(): Promise<boolean> {
    this.isClosing = true;
    if (this.commands.hasMarks && !this.commands.isWaitingAtPrompt)
      await this.changes.waitUntilAsync(() => this.commands.isWaitingAtPrompt || this.hasExited, Resources.promptSettleMilliseconds, this.disposal.signal);
    return this.terminal.endAsync();
  }

  public restart(process: IPtyProcess, nonce: string | null, size: TerminalSize): void {
    this.restartOffsets.push(this.text.endOffset);
    this.wakeup?.stop();
    this.terminal = this.startTerminal(process);
    if (this.flow.isPaused)
      this.terminal.pause();
    this.scanner = nonce === null ? null : new MarkScanner(nonce);
    this.hasIntegration = nonce !== null;
    this.commands = this.trackCommands();
    this.options.reset();
    this.hasAnsweredOptions = false;
    this.isPromptNew = false;
    this.replacePromptLine(null);
    this.typedLines.clear();
    this.reportedCwd = null;
    this.exit = null;
    this.isClosing = false;
    this.size = size;
    this.mirror.resize(size);
    this.insert(Resources.restartReset + Resources.lineFeed.repeat(this.size.rows) + Resources.cursorHome, true);
  }

  public writeNote(text: string): void {
    this.insert(TerminalSession.toNote(text));
  }

  public toSummary(folder: string, isAgentTerminal: boolean, isPanelTerminal: boolean, owner: string | null, opensTab: boolean,
    name: string | null, shellName: string | null): TerminalSummary {
    return new TerminalSummary(this.sessionId, this.shellId, folder, this.mirror.title, this.exit, isAgentTerminal, isPanelTerminal, owner, opensTab,
      name, shellName, this.shellKind);
  }

  public disposeAsync(): Promise<readonly unknown[]> {
    this.disposal.abort();
    this.wakeup?.stop();
    this.batcher.dispose();
    this.flow.dispose();
    this.mirror.dispose();
    return this.history.closeAsync();
  }

  public static toNote(text: string): string {
    return Resources.noteStyle + text.replace(Resources.controlCharacters, Resources.controlReplacement) + Resources.styleReset + Resources.noteLineBreak;
  }

  private receive(data: string): void {
    const marks: readonly ShellMark[] = this.scanner?.scan(data, this.receivedOffset) ?? [];
    this.batcher.append(data, marks.flatMap(t => {
      const edge: TerminalInputEdge | null = this.readInputEdge(t);
      return edge === null ? [] : [new TerminalInputMark(t.offset - this.receivedOffset, edge)];
    }));
    this.flow.produce(data.length);
    let position: number = 0;
    let mirrored: number = 0;
    for (const mark of marks) {
      const end: number = mark.offset - this.receivedOffset;
      this.text.append(data.slice(position, end));
      position = end;
      const edge: TerminalInputEdge | null = this.readInputEdge(mark);
      if (mark.kind === MarkKind.PromptStart || edge !== null) {
        this.mirror.write(data.slice(mirrored, end));
        mirrored = end;
      }
      if (mark.kind === MarkKind.PromptStart)
        this.replacePromptLine(this.mirror.anchorAsync(null));
      if (edge === TerminalInputEdge.Start)
        this.mirror.startInput();
      else if (edge === TerminalInputEdge.RightPrompt)
        this.mirror.markRightPrompt();
      else if (edge === TerminalInputEdge.End)
        this.endInput(mark.kind === MarkKind.OutputStart, mark.value);
      this.applyMark(new ShellMark(mark.kind, mark.value, this.text.endOffset, mark.values));
    }
    this.mirror.write(data.slice(mirrored));
    this.text.append(data.slice(position));
    this.wakeup?.receive(data);
    this.receivedOffset += data.length;
    this.changes.notify();
  }

  private replacePromptLine(line: Promise<MirrorLine> | null): void {
    const previous: Promise<MirrorLine> | null = this.promptLine;
    this.promptLine = line;
    void (line ?? Promise.resolve()).then(() => previous?.then(t => t.dispose()));
  }

  private trackCommands(): CommandTracker {
    return new CommandTracker((start, end) => this.text.readRange(start, end));
  }

  private insert(data: string, endsInput: boolean = false): void {
    const endInput: boolean = endsInput && this.marksInput;
    this.mirror.write(data);
    if (endInput)
      this.endInput(false, null);
    this.batcher.append(data, endInput ? [new TerminalInputMark(data.length, TerminalInputEdge.End)] : []);
    this.flow.produce(data.length);
    this.changes.notify();
  }

  private applyMark(mark: ShellMark): void {
    if (mark.kind === MarkKind.Options) {
      this.hasAnsweredOptions = true;
      this.options.answer(mark.values);
    }
    else if (mark.kind === MarkKind.OutputStart || mark.kind === MarkKind.PromptStart && this.isPromptNew)
      this.options.reset();
    if (mark.kind === MarkKind.CommandEnd || mark.kind === MarkKind.Property)
      this.isPromptNew = true;
    else if (mark.kind === MarkKind.PromptStart)
      this.isPromptNew = false;
    this.commands.apply(mark);
    this.settleTypedLines(mark);
    if (mark.kind === MarkKind.CommandEnd) {
      const exitCode: number | null = this.commands.lastCommand?.exitCode ?? null;
      this.listener.onCommandEnded(new TerminalCommandEnded(this.sessionId,
        exitCode !== null && exitCode >= ProtocolResources.minimumExitCode && exitCode <= ProtocolResources.maximumExitCode ? exitCode : null));
    }
    else if (mark.kind === MarkKind.PromptStart)
      this.listener.onPromptStarted(new TerminalReference(this.sessionId));
    const cwd: string | null = this.commands.cwd;
    if (cwd === null || cwd === this.reportedCwd || cwd.trim().length === 0 || cwd.length > ProtocolResources.maximumPathLength)
      return;
    this.reportedCwd = cwd;
    this.listener.onCwdChanged(new TerminalCwd(this.sessionId, cwd));
  }

  private settleTypedLines(mark: ShellMark): void {
    const command: TrackedCommand | null = mark.kind === MarkKind.OutputStart ? this.commands.runningCommand
      : mark.kind === MarkKind.CommandEnd ? this.commands.lastCommand : null;
    for (const line of this.typedLines) {
      if (command !== null)
        line.command = command;
      else if (mark.kind === MarkKind.PromptStart)
        line.prompt(mark.offset);
      if (!line.isOpen)
        this.typedLines.delete(line);
    }
  }

  private startTerminal(process: IPtyProcess): PseudoTerminal {
    const terminal: PseudoTerminal = new PseudoTerminal(process, {
      onData: t => {
        if (this.terminal === terminal)
          this.receive(t);
      },
      onExit: t => {
        if (this.terminal === terminal)
          this.end(t);
      },
      onResizeUnasked: () => this.listener.onResizeUnasked(this.sessionId),
      onReleasingKeys: () => {
        if (this.terminal === terminal)
          this.wakeup?.beforeInput();
      }
    }, this.windowsPty !== null);
    return terminal;
  }

  private end(exitCode: number | null): void {
    this.wakeup?.stop();
    this.options.reset();
    this.batcher.flush();
    this.exit = new TerminalExit(exitCode, this.isClosing ? EndedBy.Close : EndedBy.Exit);
    this.listener.onExited(new TerminalExited(this.sessionId, this.exit));
    this.changes.notify();
  }

  private redraw(): void {
    if (this.size.rows < 2)
      return;
    this.terminal.resize(new TerminalSize(this.size.columns, this.size.rows - 1));
    this.terminal.resize(this.size);
    this.watchResize();
  }

  private beforeInput(): void {
    if (!this.terminal.isHoldingKeys)
      this.wakeup?.beforeInput();
  }

  private watchResize(): void {
    if (this.commands.isWaitingAtPrompt)
      this.wakeup?.watch();
    else
      this.wakeup?.stop();
  }

  private endInput(startsCommand: boolean, command: string | null): void {
    void this.mirror.endInput().then(t => {
      if (startsCommand && t !== null)
        this.listener.onCommandStarted(TerminalSession.toCommand(command) ?? t);
    }).catch((error: unknown) => this.listener.onFailed(this.sessionId, FailureText.read(error)));
  }

  private readInputEdge(mark: ShellMark): TerminalInputEdge | null {
    return this.marksInput ? TerminalSession.toInputEdge(mark.kind) : null;
  }

  private static toCommand(value: string | null): string | null {
    if (value?.startsWith(Resources.commandProperty) !== true)
      return null;
    const text: string = value.slice(Resources.commandProperty.length);
    const end: number = text.search(Resources.terminalSessionLineBreak);
    const command: string = (end < 0 ? text : text.slice(0, end)).trim().slice(0, ProtocolResources.maximumSuggestionLength).trim();
    return command.length === 0 ? null : command;
  }

  private static toInputEdge(kind: MarkKind): TerminalInputEdge | null {
    switch (kind) {
      case MarkKind.PromptEnd:
        return TerminalInputEdge.Start;
      case MarkKind.RightPrompt:
        return TerminalInputEdge.RightPrompt;
      case MarkKind.ContinuationEnd:
        return TerminalInputEdge.Continuation;
      case MarkKind.Property:
      case MarkKind.Options:
        return null;
      default:
        return TerminalInputEdge.End;
    }
  }
}
