/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources as ProtocolResources, TerminalLine, TerminalTextRun, TerminalTextStyle } from "@noldova/terminal.protocol";
import type { IBufferCell, IBufferLine } from "@xterm/headless";

import { Resources } from "../resources.ts";

export class TerminalLineReader {
  private readonly cell: IBufferCell;

  public constructor(cell: IBufferCell) {
    this.cell = cell;
  }

  public read(line: IBufferLine, isContinued: boolean): TerminalLine {
    const end: number = isContinued ? line.length : this.contentEnd(line);
    return this.isPlain(line, end) ? TerminalLineReader.readPlain(line, end) : this.readRuns(line, end);
  }

  private isPlain(line: IBufferLine, end: number): boolean {
    for (let x: number = 0; x < end; x++)
      if (line.getCell(x, this.cell)?.isAttributeDefault() === false)
        return false;
    return true;
  }

  private readRuns(line: IBufferLine, end: number): TerminalLine {
    const runs: TerminalTextRun[] = [];
    let text: string = "";
    let length: number = 0;
    let foreground: number = ProtocolResources.defaultColor;
    let background: number = ProtocolResources.defaultColor;
    let style: number = 0;
    for (let x: number = 0; x < end; x++) {
      const cell: IBufferCell | undefined = line.getCell(x, this.cell);
      if (Object.isUndefined(cell) || cell.getWidth() === 0)
        continue;
      const chars: string = cell.getChars() || Resources.blankCell;
      const isPlain: boolean = cell.isAttributeDefault();
      const cellForeground: number = isPlain ? ProtocolResources.defaultColor : TerminalLineReader.foregroundOf(cell);
      const cellBackground: number = isPlain ? ProtocolResources.defaultColor : TerminalLineReader.backgroundOf(cell);
      const cellStyle: number = isPlain ? 0 : TerminalLineReader.styleOf(cell);
      if (length > 0 && (cellForeground !== foreground || cellBackground !== background || cellStyle !== style)) {
        runs.push(new TerminalTextRun(length, foreground, background, style));
        length = 0;
      }
      foreground = cellForeground;
      background = cellBackground;
      style = cellStyle;
      text += chars;
      length += chars.length;
    }
    runs.push(new TerminalTextRun(length, foreground, background, style));
    return new TerminalLine(text, line.isWrapped, runs);
  }

  private static readPlain(line: IBufferLine, end: number): TerminalLine {
    const text: string = line.translateToString(false, 0, end);
    const runs: TerminalTextRun[] = text.length === 0 ? [] : [new TerminalTextRun(text.length, ProtocolResources.defaultColor, ProtocolResources.defaultColor, 0)];
    return new TerminalLine(text, line.isWrapped, runs);
  }

  private contentEnd(line: IBufferLine): number {
    let end: number = line.length;
    while (end > 0 && this.isBlank(line.getCell(end - 1, this.cell)))
      end -= 1;
    return end;
  }

  private isBlank(cell: IBufferCell | undefined): boolean {
    return !Object.isUndefined(cell) && ((cell.getCode() === 0 && cell.isAttributeDefault()) || (cell.getChars().trim().length === 0 && cell.isBgDefault() &&
      !cell.isInverse() && !cell.isUnderline() && !cell.isStrikethrough() && !cell.isOverline()));
  }

  private static foregroundOf(cell: IBufferCell): number {
    if (cell.isFgDefault())
      return ProtocolResources.defaultColor;
    return cell.isFgRGB() ? ProtocolResources.rgbColor + cell.getFgColor() : cell.getFgColor();
  }

  private static backgroundOf(cell: IBufferCell): number {
    if (cell.isBgDefault())
      return ProtocolResources.defaultColor;
    return cell.isBgRGB() ? ProtocolResources.rgbColor + cell.getBgColor() : cell.getBgColor();
  }

  private static styleOf(cell: IBufferCell): number {
    let style: number = 0;
    if (cell.isBold())
      style |= TerminalTextStyle.Bold;
    if (cell.isDim())
      style |= TerminalTextStyle.Dim;
    if (cell.isItalic())
      style |= TerminalTextStyle.Italic;
    if (cell.isUnderline())
      style |= TerminalTextStyle.Underline;
    if (cell.isBlink())
      style |= TerminalTextStyle.Blink;
    if (cell.isInverse())
      style |= TerminalTextStyle.Inverse;
    if (cell.isInvisible())
      style |= TerminalTextStyle.Invisible;
    if (cell.isStrikethrough())
      style |= TerminalTextStyle.Strikethrough;
    if (cell.isOverline())
      style |= TerminalTextStyle.Overline;
    return style;
  }
}
