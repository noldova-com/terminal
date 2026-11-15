/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources as ProtocolResources } from "@noldova/terminal.protocol";
import type { IBuffer, IBufferLine, IDecoration, IDisposable, IMarker, Terminal } from "@xterm/xterm";

import { Resources } from "../../resources.ts";

export class CommandSuggestion {
  private readonly terminal: Terminal;
  private readonly subscriptions: readonly IDisposable[];
  private commands: readonly string[] = [];
  private start: IMarker | null = null;
  private startColumn: number = 0;
  private rightPrompt: IMarker | null = null;
  private rightPromptColumn: number = 0;
  private decoration: IDecoration | null = null;
  private shown: string | null = null;
  private shownAt: string = "";
  private isEnabled: boolean = true;
  private isHeld: boolean = false;
  private expected: string | null = null;
  private isQuiet: boolean = false;
  private isLost: boolean = false;
  private quietTimer: ReturnType<typeof setTimeout> | undefined = undefined;
  private lostTimer: ReturnType<typeof setTimeout> | undefined = undefined;

  public constructor(terminal: Terminal) {
    this.terminal = terminal;
    this.subscriptions = [
      terminal.onData(t => this.hold(t)),
      terminal.onWriteParsed(() => this.answer()),
      terminal.onCursorMove(() => this.update()),
      terminal.onResize(() => this.update())
    ];
  }

  public enable(isEnabled: boolean): void {
    this.isEnabled = isEnabled;
    if (!isEnabled)
      this.commands = [];
    this.update();
  }

  public setCommands(commands: readonly string[]): void {
    this.commands = commands;
    this.update();
  }

  public remember(command: string): void {
    this.setCommands([command, ...this.commands.filter(t => t !== command)].slice(0, ProtocolResources.maximumSuggestedCommands));
  }

  public startInput(): void {
    this.startInputAt(0, this.terminal.buffer.active.cursorX);
  }

  public startInputAt(rowsAbove: number, column: number, rightPrompt: number | null = null): void {
    this.start?.dispose();
    this.rightPrompt?.dispose();
    const isNormal: boolean = this.terminal.buffer.active.type !== Resources.alternateBuffer;
    this.start = isNormal ? this.terminal.registerMarker(-rowsAbove) : null;
    this.startColumn = column;
    this.rightPrompt = isNormal && rightPrompt !== null ? this.terminal.registerMarker(-rowsAbove) : null;
    this.rightPromptColumn = rightPrompt ?? 0;
    this.update();
  }

  public markRightPrompt(): void {
    const start: IMarker | null = this.start;
    const buffer: IBuffer = this.terminal.buffer.active;
    if (start === null || start.isDisposed || buffer.baseY + buffer.cursorY !== start.line)
      return;
    this.rightPrompt?.dispose();
    this.rightPrompt = this.terminal.registerMarker(0);
    this.rightPromptColumn = buffer.cursorX;
    this.update();
  }

  public endInput(): void {
    this.start?.dispose();
    this.start = null;
    this.rightPrompt?.dispose();
    this.rightPrompt = null;
    this.update();
  }

  public take(event: KeyboardEvent): string | null {
    const rest: string | null = this.shown;
    if (rest === null || event.type !== Resources.keyDownEvent || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
      || !Resources.suggestionKeys.includes(event.key))
      return null;
    this.hold(rest);
    return rest;
  }

  public readLine(): string | null {
    return this.isHolding() ? this.expected : this.readTyped();
  }

  public readTyped(): string | null {
    const start: IMarker | null = this.start;
    const buffer: IBuffer = this.terminal.buffer.active;
    if (start === null || start.isDisposed || buffer.type === Resources.alternateBuffer)
      return null;
    return CommandSuggestion.readBetween(buffer, start.line, this.startColumn, buffer.baseY + buffer.cursorY, buffer.cursorX);
  }

  public dispose(): void {
    for (const subscription of this.subscriptions)
      subscription.dispose();
    clearTimeout(this.quietTimer);
    clearTimeout(this.lostTimer);
    this.start?.dispose();
    this.start = null;
    this.rightPrompt?.dispose();
    this.rightPrompt = null;
    this.hide();
  }

  private hold(input: string): void {
    const typed: string | null = this.isHeld ? this.expected : this.readTyped();
    this.expected = typed !== null && Resources.plainInput.test(input) ? typed + input : null;
    this.isHeld = true;
    this.isQuiet = false;
    this.isLost = false;
    clearTimeout(this.quietTimer);
    clearTimeout(this.lostTimer);
    this.lostTimer = setTimeout(() => {
      this.isLost = true;
      this.update();
    }, Resources.inputLostMilliseconds);
    this.hide();
  }

  private answer(): void {
    if (this.isHeld) {
      this.isQuiet = false;
      clearTimeout(this.quietTimer);
      this.quietTimer = setTimeout(() => {
        this.isQuiet = true;
        this.update();
      }, Resources.inputQuietMilliseconds);
    }
    this.update();
  }

  private isHolding(): boolean {
    if (!this.isHeld)
      return false;
    const typed: string | null = this.readTyped();
    const expected: string | null = this.expected;
    this.isHeld = typed !== expected && !((this.isQuiet || this.isLost) && (typed === null || expected?.startsWith(typed) !== true));
    return this.isHeld;
  }

  private update(): void {
    const buffer: IBuffer = this.terminal.buffer.active;
    const row: number = buffer.baseY + buffer.cursorY;
    const written: number = CommandSuggestion.findWritten(buffer, row, buffer.cursorX);
    const rest: string | null = this.isEnabled && !this.isHolding() ? this.find(row, written) : null;
    const at: string = Resources.formatShownAt(row, buffer.cursorX, written, this.terminal.cols);
    if (rest === this.shown && at === this.shownAt)
      return;
    this.hide();
    if (rest !== null)
      this.show(rest, written - buffer.cursorX, at);
  }

  private find(row: number, written: number): string | null {
    const typed: string | null = this.readTyped();
    if (typed === null || typed.trim().length === 0 || written === -1 || written === this.terminal.buffer.active.cursorX
      || written < this.findRightPrompt(row))
      return null;
    const command: string | undefined = this.commands.find(t => t.length > typed.length && t.startsWith(typed));
    return command === undefined ? null : command.slice(typed.length);
  }

  private findRightPrompt(row: number): number {
    const marker: IMarker | null = this.rightPrompt;
    return marker !== null && !marker.isDisposed && marker.line === row ? this.rightPromptColumn : this.terminal.cols;
  }

  private show(rest: string, room: number, at: string): void {
    const buffer: IBuffer = this.terminal.buffer.active;
    const characters: string[] = [...rest].slice(0, room);
    const marker: IMarker = this.terminal.registerMarker(0);
    const decoration: IDecoration | undefined = this.terminal.registerDecoration({ marker, x: buffer.cursorX, width: characters.length, layer: Resources.suggestionDecorationLayer });
    if (decoration === undefined) {
      marker.dispose();
      return;
    }
    decoration.onDispose(() => marker.dispose());
    decoration.onRender(t => this.fill(t, characters));
    this.decoration = decoration;
    this.shown = rest;
    this.shownAt = at;
  }

  private fill(element: HTMLElement, characters: readonly string[]): void {
    const { theme, fontFamily = "", fontSize = Resources.defaultFontSize } = this.terminal.options;
    element.classList.add(Resources.suggestionClass);
    element.style.color = theme?.brightBlack ?? "";
    element.style.fontFamily = fontFamily;
    element.style.fontSize = Resources.formatPixels(fontSize);
    element.style.lineHeight = element.style.height;
    const width: string = Resources.formatPixels(element.getBoundingClientRect().width / characters.length);
    element.replaceChildren(...characters.map(t => {
      const cell: HTMLSpanElement = document.createElement(Resources.spanTag);
      cell.textContent = t;
      cell.style.width = width;
      return cell;
    }));
  }

  private hide(): void {
    this.decoration?.dispose();
    this.decoration = null;
    this.shown = null;
    this.shownAt = "";
  }

  private static readBetween(buffer: IBuffer, row: number, column: number, cursorRow: number, cursorColumn: number): string | null {
    if (cursorRow < row || cursorRow === row && cursorColumn < column)
      return null;
    let text: string = "";
    for (let index: number = row; index <= cursorRow; index++) {
      const line: IBufferLine | undefined = buffer.getLine(index);
      if (line === undefined || index > row && !line.isWrapped)
        return null;
      text += line.translateToString(false, index === row ? column : 0, index === cursorRow ? cursorColumn : undefined);
    }
    return text;
  }

  private static findWritten(buffer: IBuffer, row: number, column: number): number {
    let written: number = -1;
    for (let index: number = row; ; index++) {
      const line: IBufferLine | undefined = buffer.getLine(index);
      if (line === undefined || index > row && !line.isWrapped)
        return written;
      const text: string = line.translateToString(false, index === row ? column : 0);
      const found: number = text.search(Resources.nonBlankPattern);
      if (index === row)
        written = column + (found === -1 ? text.length : found);
      else if (found !== -1)
        return -1;
    }
  }
}
