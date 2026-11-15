/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources as ProtocolResources, TerminalInputStart, TerminalRunOutput, type TerminalLine, type TerminalSize } from "@noldova/terminal.protocol";
import { SerializeAddon } from "@xterm/addon-serialize";
import type { IBuffer, IBufferLine, IMarker, Terminal as XtermTerminal } from "@xterm/headless";

import type { ITerminalMirrorListener } from "../interfaces/i-terminal-mirror-listener.ts";
import { MirrorLine } from "../models/mirror-line.ts";
import { MirrorSnapshot } from "../models/mirror-snapshot.ts";
import { Resources } from "../resources.ts";
import { EscapeSequenceTracker } from "./escape-sequence-tracker.ts";
import type { TerminalHistory } from "./terminal-history.ts";
import { TerminalLineReader } from "./terminal-line-reader.ts";
import { XtermHeadlessLoader } from "./xterm-headless-loader.ts";

export class TerminalMirror {
  private readonly terminal: XtermTerminal;
  private readonly serializer: SerializeAddon;
  private readonly tracker: EscapeSequenceTracker = new EscapeSequenceTracker();
  private readonly history: TerminalHistory;
  private readonly reader: TerminalLineReader;
  private readonly listener: ITerminalMirrorListener;
  private readonly anchors: Map<MirrorLine, IMarker> = new Map<MirrorLine, IMarker>();
  private writtenOffset: number = 0;
  private removedLines: number = 0;
  private currentTitle: string = "";
  private oldest: TerminalLine | null = null;
  private oldestMarker: IMarker | null = null;
  private inputStart: IMarker | undefined = undefined;
  private inputColumn: number = 0;
  private rightPrompt: number | null = null;
  private isDisposed: boolean = false;

  public constructor(size: TerminalSize, history: TerminalHistory, listener: ITerminalMirrorListener) {
    this.history = history;
    this.listener = listener;
    this.terminal = XtermHeadlessLoader.createTerminal({ allowProposedApi: true, cols: size.columns, rows: size.rows, scrollback: Resources.scrollback });
    this.serializer = new SerializeAddon();
    this.terminal.loadAddon(this.serializer);
    this.reader = new TerminalLineReader(this.terminal.buffer.normal.getNullCell());
    this.terminal.onData(t => this.listener.onReply(t));
    this.terminal.onTitleChange(t => this.changeTitle(t));
    this.terminal.onScroll(() => this.capture());
    this.terminal.parser.registerCsiHandler({ final: Resources.eraseInDisplayFinal }, t => this.eraseSaved(t));
    this.terminal.parser.registerCsiHandler({ prefix: Resources.privatePrefix, final: Resources.eraseInDisplayFinal }, t => this.eraseSaved(t));
    this.terminal.parser.registerEscHandler({ final: Resources.fullResetFinal }, () => this.reset());
  }

  public get title(): string {
    return this.currentTitle;
  }

  public write(data: string): void {
    this.writtenOffset += data.length;
    this.tracker.track(data);
    const offset: number = this.writtenOffset;
    this.terminal.write(data, () => this.listener.onParsed(offset));
  }

  public resize(size: TerminalSize): void {
    this.terminal.write("", () => this.resizeNow(size));
  }

  public snapshotAsync(): Promise<MirrorSnapshot> {
    const offset: number = this.writtenOffset;
    const pending: string = this.tracker.pending;
    return new Promise<MirrorSnapshot>(resolve => this.terminal.write("", () => resolve(new MirrorSnapshot(this.serializer.serialize({ scrollback: Resources.scrollback }), pending, offset,
      this.readInputStart()))));
  }

  public startInput(): void {
    this.terminal.write("", () => {
      this.inputStart?.dispose();
      const buffer: IBuffer = this.terminal.buffer.active;
      this.inputStart = buffer.type === Resources.normalBufferType ? this.terminal.registerMarker(0) : undefined;
      this.inputColumn = buffer.cursorX;
      this.rightPrompt = null;
    });
  }

  public markRightPrompt(): void {
    this.terminal.write("", () => {
      const start: IMarker | undefined = this.inputStart;
      const buffer: IBuffer = this.terminal.buffer.active;
      if (start !== undefined && !start.isDisposed && buffer.baseY + buffer.cursorY === start.line)
        this.rightPrompt = buffer.cursorX;
    });
  }

  public endInput(): Promise<string | null> {
    return new Promise<string | null>(resolve => this.terminal.write("", () => {
      const line: string | null = this.isDisposed ? null : this.readInput();
      this.inputStart?.dispose();
      this.inputStart = undefined;
      resolve(line);
    }));
  }

  public isBracketedPasteAsync(): Promise<boolean> {
    return new Promise<boolean>(resolve => this.terminal.write("", () => resolve(this.terminal.modes.bracketedPasteMode)));
  }

  public anchorAsync(at: MirrorLine | null): Promise<MirrorLine> {
    return new Promise<MirrorLine>(resolve => this.terminal.write("", () => {
      const buffer: IBuffer = this.terminal.buffer.normal;
      const cursor: number = buffer.baseY + buffer.cursorY;
      const index: number | null = at === null ? cursor : at.index;
      const marker: IMarker | undefined = index === null || this.terminal.buffer.active.type !== Resources.normalBufferType ? undefined
        : this.terminal.registerMarker(index - cursor);
      const line: MirrorLine = new MirrorLine(at?.number ?? this.removedLines + cursor, marker);
      if (marker !== undefined) {
        this.anchors.set(line, marker);
        marker.onDispose(() => this.anchors.delete(line));
      }
      resolve(line);
    }));
  }

  public readLinesAsync(start: MirrorLine, end: MirrorLine | null, maximum: number): Promise<TerminalRunOutput> {
    return new Promise<TerminalRunOutput>(resolve => this.terminal.write("", () => resolve(this.readLines(start.number, end?.number ?? null, maximum))));
  }

  public dispose(): void {
    this.isDisposed = true;
    this.releaseOldest();
    this.terminal.dispose();
  }

  private readInput(): string | null {
    const start: IMarker | undefined = this.inputStart;
    if (start === undefined || start.isDisposed)
      return null;
    const buffer: IBuffer = this.terminal.buffer.normal;
    let text: string = "";
    let line: IBufferLine | undefined = buffer.getLine(start.line);
    for (let index: number = start.line; line !== undefined; index++) {
      const next: IBufferLine | undefined = buffer.getLine(index + 1);
      const continues: boolean = next?.isWrapped === true;
      const end: number | undefined = index === start.line && !continues ? this.findRightPrompt(line) : undefined;
      text += line.translateToString(!continues, index === start.line ? this.inputColumn : 0, end);
      line = continues ? next : undefined;
    }
    if (Resources.terminalMirrorLeadingWhiteSpace.test(text))
      return null;
    const command: string = text.trim().slice(0, ProtocolResources.maximumSuggestionLength).trim();
    return command.length === 0 ? null : command;
  }

  private findRightPrompt(line: IBufferLine): number | undefined {
    const column: number | null = this.rightPrompt;
    return column !== null && column > this.inputColumn && line.translateToString(false, column - 1, column).trim().length === 0 ? column : undefined;
  }

  private readInputStart(): TerminalInputStart | null {
    const buffer: IBuffer = this.terminal.buffer.active;
    const start: IMarker | undefined = this.inputStart;
    const cursor: number = buffer.baseY + buffer.cursorY;
    if (start === undefined || start.isDisposed || buffer.type !== Resources.normalBufferType || start.line > cursor)
      return null;
    return new TerminalInputStart(cursor - start.line, this.inputColumn, this.rightPrompt);
  }

  private readLines(start: number, end: number | null, maximum: number): TerminalRunOutput {
    const buffer: IBuffer = this.terminal.buffer.normal;
    const last: number = Math.min(end ?? this.removedLines + buffer.baseY + buffer.cursorY + 1, this.removedLines + buffer.length);
    let first: number = Math.max(start, last - maximum, this.removedLines);
    while (first < last && buffer.getLine(first - this.removedLines)?.isWrapped === true)
      first++;
    const lines: TerminalLine[] = [];
    let line: IBufferLine | undefined = buffer.getLine(first - this.removedLines);
    for (let number: number = first; number < last && line !== undefined; number++) {
      const next: IBufferLine | undefined = buffer.getLine(number + 1 - this.removedLines);
      lines.push(this.reader.read(line, next?.isWrapped === true));
      line = next;
    }
    return new TerminalRunOutput(lines, Math.max(0, Math.min(first, last) - start));
  }

  private resizeNow(size: TerminalSize): void {
    if (this.isDisposed)
      return;

    this.releaseOldest();
    const buffer: IBuffer = this.terminal.buffer.normal;
    this.terminal.options.scrollback = Math.max(Resources.scrollback, buffer.length * Math.ceil(this.terminal.cols / size.columns));
    this.terminal.resize(size.columns, size.rows);
    const excess: number = buffer.baseY - Resources.scrollback;
    let line: IBufferLine | undefined = buffer.getLine(0);
    for (let y: number = 0; y < excess && line !== undefined; y++) {
      const next: IBufferLine | undefined = buffer.getLine(y + 1);
      this.store(this.reader.read(line, next?.isWrapped === true));
      line = next;
    }
    this.terminal.options.scrollback = Resources.scrollback;
    this.capture();
    for (const [anchor, marker] of this.anchors)
      anchor.renumber(this.removedLines + marker.line);
  }

  private capture(): void {
    if (this.oldestMarker?.isDisposed === true && this.oldest !== null)
      this.store(this.oldest);
    this.releaseOldest();
    const buffer: IBuffer = this.terminal.buffer.normal;
    if (buffer.baseY === Resources.scrollback) {
      this.oldestMarker = this.terminal.registerMarker(-buffer.baseY - buffer.cursorY) ?? null;
      const line: IBufferLine | undefined = buffer.getLine(0);
      if (this.oldestMarker !== null && line !== undefined)
        this.oldest = this.reader.read(line, buffer.getLine(1)?.isWrapped === true);
    }
  }

  private releaseOldest(): void {
    this.oldestMarker?.dispose();
    this.oldestMarker = null;
    this.oldest = null;
  }

  private store(line: TerminalLine): void {
    this.history.append(line);
    this.removedLines++;
  }

  private eraseSaved(params: readonly (number | number[])[]): boolean {
    if (params[0] === Resources.eraseSavedLinesParameter && this.terminal.buffer.active.type === Resources.normalBufferType) {
      this.removedLines += this.terminal.buffer.normal.baseY;
      this.forgetStored();
    }
    return false;
  }

  private reset(): boolean {
    this.removedLines += this.terminal.buffer.normal.length;
    return this.forgetStored();
  }

  private forgetStored(): boolean {
    this.releaseOldest();
    this.history.clear();
    return false;
  }

  private changeTitle(title: string): void {
    this.currentTitle = title.slice(0, ProtocolResources.maximumTitleLength);
    this.listener.onTitleChanged(this.currentTitle);
  }
}
