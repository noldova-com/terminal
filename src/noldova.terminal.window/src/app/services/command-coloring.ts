/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources as ProtocolResources, TerminalShellKind } from "@noldova/terminal.protocol";
import type { IBuffer, IBufferCell, IBufferLine, IDisposable, IMarker, Terminal } from "@xterm/xterm";

import { Resources } from "../../resources.ts";
import { CommandTokenKind } from "../enums/command-token-kind.ts";
import { CommandColorRun } from "../models/command-color-run.ts";
import { CommandColorSpan } from "../models/command-color-span.ts";
import { CommandColors } from "../models/command-colors.ts";
import { CommandContinuation } from "../models/command-continuation.ts";
import { CommandLineTokens } from "./command-line-tokens.ts";

export class CommandColoring {
  private readonly terminal: Terminal;
  private readonly log: (message: string) => void;
  private readonly subscriptions: readonly IDisposable[];
  private isEnabled: boolean = false;
  private isPowerShell: boolean = false;
  private isZsh: boolean = false;
  private asksNames: boolean = false;
  private colors: CommandColors = new CommandColors();
  private start: IMarker | null = null;
  private startColumn: number = 0;
  private rightPrompt: IMarker | null = null;
  private rightPromptColumn: number = 0;
  private continuations: CommandContinuation[] = [];
  private runs: CommandColorRun[] = [];
  private drawn: string = "";
  private kept: CommandColorRun[] = [];
  private find: ((names: readonly string[]) => Promise<readonly string[]>) | null = null;
  private given: ((names: readonly string[]) => Promise<readonly string[]>) | null = null;
  private missing: Map<string, boolean> = new Map<string, boolean>();
  private isAsking: boolean = false;
  private finders: number = 0;
  private resumes: number = 0;

  public constructor(terminal: Terminal, log: (message: string) => void) {
    this.terminal = terminal;
    this.log = log;
    this.subscriptions = [
      terminal.onWriteParsed(() => this.update()),
      terminal.onResize(() => this.update())
    ];
  }

  public enable(isEnabled: boolean): void {
    this.isEnabled = isEnabled;
    if (!isEnabled)
      this.drop(this.kept.splice(0));
    this.update();
  }

  public setShell(kind: TerminalShellKind): void {
    this.isPowerShell = kind === TerminalShellKind.PowerShell;
    this.isZsh = kind === TerminalShellKind.Zsh;
    this.asksNames = kind === TerminalShellKind.Bash || kind === TerminalShellKind.Zsh || kind === TerminalShellKind.PowerShell;
    this.update();
  }

  public setFinder(find: (names: readonly string[]) => Promise<readonly string[]>): void {
    this.find = find;
    this.given = find;
    this.finders++;
    this.isAsking = false;
    this.missing = new Map<string, boolean>();
    this.update();
  }

  public resumeFinder(): void {
    this.resumes++;
    if (!Object.isNull(this.find) || Object.isNull(this.given))
      return;
    this.find = this.given;
    this.update();
  }

  public setColors(colors: CommandColors): void {
    this.colors = colors;
    for (const run of [...this.kept, ...this.runs])
      this.paint(run);
  }

  public startInput(): void {
    this.startInputAt(0, this.terminal.buffer.active.cursorX);
  }

  public startInputAt(rowsAbove: number, column: number, rightPrompt: number | null = null): void {
    this.keep();
    this.leaveLine();
    this.missing = new Map<string, boolean>();
    const isNormal: boolean = this.terminal.buffer.active.type !== Resources.alternateBuffer;
    this.start = isNormal ? this.terminal.registerMarker(-rowsAbove) : null;
    this.startColumn = column;
    this.rightPrompt = isNormal && !Object.isNull(rightPrompt) ? this.terminal.registerMarker(-rowsAbove) : null;
    this.rightPromptColumn = rightPrompt ?? 0;
    this.update();
  }

  public markRightPrompt(): void {
    const start: IMarker | null = this.start;
    const buffer: IBuffer = this.terminal.buffer.active;
    if (Object.isNull(start) || start.isDisposed || buffer.baseY + buffer.cursorY !== start.line)
      return;
    this.rightPrompt?.dispose();
    this.rightPrompt = this.terminal.registerMarker(0);
    this.rightPromptColumn = buffer.cursorX;
    this.update();
  }

  public continueInput(): void {
    const start: IMarker | null = this.start;
    const buffer: IBuffer = this.terminal.buffer.active;
    if (Object.isNull(start) || start.isDisposed || buffer.baseY + buffer.cursorY <= (this.continuations.at(-1)?.marker ?? start).line)
      return;
    this.continuations.push(new CommandContinuation(this.terminal.registerMarker(0), buffer.cursorX));
    this.update();
  }

  public endInput(): void {
    this.keep();
    this.leaveLine();
  }

  public dispose(): void {
    for (const subscription of this.subscriptions)
      subscription.dispose();
    this.leaveLine();
    this.drop(this.runs.splice(0));
    this.drop(this.kept.splice(0));
    this.drawn = "";
  }

  private update(): void {
    this.dropErased();
    const found: readonly CommandColorSpan[] = this.read();
    const drawn: string = found.map(t => t.toString()).join(Resources.commandWordSeparator);
    if (drawn === this.drawn)
      return;
    const buffer: IBuffer = this.terminal.buffer.active;
    const cursorRow: number = buffer.baseY + buffer.cursorY;
    this.drop(this.runs);
    this.runs = found.map(t => new CommandColorRun(this.terminal.registerMarker(t.row - cursorRow), t.x, t.width, t.kind, t.text));
    this.drawn = drawn;
    for (const run of this.runs)
      this.paint(run);
  }

  private read(): CommandColorSpan[] {
    let text: string = "";
    if (!this.walk((_row, _x, _width, _isPlain, characters) => {
      text += characters;
    }))
      return [];
    const kinds: (CommandTokenKind | undefined)[] = new Array<CommandTokenKind | undefined>(text.length);
    const unasked: Set<string> = new Set<string>();
    for (const token of CommandLineTokens.read(text, this.isPowerShell, this.isZsh)) {
      const name: string = text.slice(token.start, token.end);
      const isAsked: boolean = token.kind === CommandTokenKind.Command && this.asksNames && Resources.askedCommandPattern.test(name);
      if (isAsked && !this.missing.has(name))
        unasked.add(name);
      kinds.fill(isAsked && this.missing.get(name) === true ? CommandTokenKind.NotFound : token.kind, token.start, token.end);
    }
    this.ask([...unasked]);
    const found: CommandColorSpan[] = [];
    let unit: number = 0;
    let open: CommandColorSpan | null = null;
    this.walk((row, x, width, isPlain, characters) => {
      const kind: CommandTokenKind | undefined = isPlain ? kinds[unit] : undefined;
      unit += characters.length;
      if (open?.continuesAt(row, x, kind) === true)
        open.extend(width, characters);
      else {
        if (!Object.isNull(open))
          found.push(open);
        open = Object.isUndefined(kind) ? null : new CommandColorSpan(row, x, width, kind, characters);
      }
    });
    if (!Object.isNull(open))
      found.push(open);
    return found;
  }

  private walk(visit: (row: number, x: number, width: number, isPlain: boolean, characters: string) => void): boolean {
    const start: IMarker | null = this.start;
    const buffer: IBuffer = this.terminal.buffer.active;
    if (!this.isEnabled || Object.isNull(start) || start.isDisposed || buffer.type === Resources.alternateBuffer)
      return false;
    for (const [index, { marker, column }] of [new CommandContinuation(start, this.startColumn), ...this.continuations].entries()) {
      if (index > 0)
        visit(marker.line, column, 0, false, Resources.commandLineBreak);
      for (let row: number = marker.line; ; row++) {
        const line: IBufferLine | undefined = buffer.getLine(row);
        if (Object.isUndefined(line) || row > marker.line && !line.isWrapped)
          break;
        const first: number = row === marker.line ? column : 0;
        const limit: number = Math.min(line.length, this.findRightPrompt(row));
        const end: number = buffer.getLine(row + 1)?.isWrapped === true ? limit : this.findTextEnd(line, first, limit);
        for (let x: number = first; x < end; x++) {
          const cell: IBufferCell | undefined = line.getCell(x);
          if (!Object.isUndefined(cell) && cell.getWidth() > 0) {
            const characters: string = cell.getChars();
            visit(row, x, cell.getWidth(), cell.isFgDefault(), characters.length > 0 ? characters : Resources.emptyCellText);
          }
        }
      }
    }
    return true;
  }

  private ask(names: readonly string[]): void {
    const find: ((names: readonly string[]) => Promise<readonly string[]>) | null = this.find;
    if (Object.isNull(find) || this.isAsking || names.length === 0)
      return;
    const asked: readonly string[] = names.slice(0, ProtocolResources.maximumLookedUpCommands);
    const missing: Map<string, boolean> = this.missing;
    const finder: number = this.finders;
    const resumes: number = this.resumes;
    this.isAsking = true;
    void find(asked).then(found => {
      for (const name of asked)
        missing.set(name, found.includes(name));
    }, (error: unknown) => {
      this.log(Resources.formatCommandLookupFailed(error));
      if (this.finders === finder && this.resumes === resumes)
        this.find = null;
    }).finally(() => {
      if (this.finders !== finder)
        return;
      this.isAsking = false;
      this.update();
    });
  }

  private findTextEnd(line: IBufferLine, first: number, limit: number): number {
    for (let x: number = limit - 1; x >= first; x--) {
      const cell: IBufferCell | undefined = line.getCell(x);
      if (!Object.isUndefined(cell) && cell.getChars().trim() !== "")
        return x + cell.getWidth();
    }
    return first;
  }

  private findRightPrompt(row: number): number {
    const marker: IMarker | null = this.rightPrompt;
    return !Object.isNull(marker) && !marker.isDisposed && marker.line === row ? this.rightPromptColumn : this.terminal.cols;
  }

  private paint(run: CommandColorRun): void {
    run.decoration?.dispose();
    const color: string | undefined = this.colors.colorOf(run.kind);
    run.decoration = Object.isUndefined(color) || run.marker.isDisposed ? undefined
      : this.terminal.registerDecoration({ marker: run.marker, x: run.x, width: run.width, foregroundColor: color, layer: Resources.commandColorDecorationLayer });
  }

  private keep(): void {
    const runs: CommandColorRun[] = this.runs.splice(0);
    this.drawn = "";
    this.kept = this.kept.filter(t => !t.marker.isDisposed);
    this.kept.push(...runs);
  }

  private dropErased(): void {
    const buffer: IBuffer = this.terminal.buffer.active;
    if (buffer.type === Resources.alternateBuffer)
      return;
    const erased: CommandColorRun[] = this.kept.filter(t => !t.marker.isDisposed && t.marker.line >= buffer.baseY
      && buffer.getLine(t.marker.line)?.translateToString(false, t.x, t.x + t.width) !== t.text);
    if (erased.length === 0)
      return;
    this.drop(erased);
    this.kept = this.kept.filter(t => !erased.includes(t));
  }

  private leaveLine(): void {
    this.start?.dispose();
    this.start = null;
    this.rightPrompt?.dispose();
    this.rightPrompt = null;
    for (const continuation of this.continuations.splice(0))
      continuation.marker.dispose();
  }

  private drop(runs: readonly CommandColorRun[]): void {
    for (const run of runs) {
      run.decoration?.dispose();
      run.marker.dispose();
    }
  }
}
