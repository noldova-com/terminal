/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IBuffer, IBufferCell, IBufferCellPosition, IBufferLine, ILink, ILinkProvider, Terminal } from "@xterm/xterm";

import { Resources } from "../../resources.ts";

export class UrlLinkProvider implements ILinkProvider {
  private readonly terminal: Terminal;
  private readonly activate: (event: MouseEvent, url: string) => void;
  private readonly hover: (url: string | null) => void;

  public constructor(terminal: Terminal, activate: (event: MouseEvent, url: string) => void, hover: (url: string | null) => void) {
    this.terminal = terminal;
    this.activate = activate;
    this.hover = hover;
  }

  public provideLinks(bufferLineNumber: number, callback: (links: ILink[] | undefined) => void): void {
    const buffer: IBuffer = this.terminal.buffer.active;
    const row: number = bufferLineNumber - 1;
    let first: number = row;
    while (first > 0 && buffer.getLine(first)?.isWrapped === true && (row - first + 1) * this.terminal.cols < Resources.maximumLinkLength)
      first--;
    const text: string = [...UrlLinkProvider.cells(buffer, first)].map(t => t[0]).join("");
    const matches: Iterator<RegExpExecArray> = text.matchAll(Resources.plainLinkPattern);
    const links: ILink[] = [];
    let match: IteratorResult<RegExpExecArray> = matches.next();
    let start: IBufferCellPosition = { x: 1, y: bufferLineNumber };
    let offset: number = 0;
    for (const [, cellStart, cellEnd] of UrlLinkProvider.cells(buffer, first)) {
      if (match.done === true)
        break;
      if (offset === match.value.index)
        start = cellStart;
      if (offset === match.value.index + match.value[0].length - 1) {
        if (start.y <= bufferLineNumber && cellEnd.y >= bufferLineNumber)
          links.push(this.toLink(match.value[0], start, cellEnd));
        match = matches.next();
      }
      offset++;
    }
    callback(links.length > 0 ? links : undefined);
  }

  private static *cells(buffer: IBuffer, first: number): Generator<[string, IBufferCellPosition, IBufferCellPosition]> {
    const cell: IBufferCell = buffer.getNullCell();
    let length: number = 0;
    for (let y: number = first; length < Resources.linkScanLength; y++) {
      const line: IBufferLine | undefined = buffer.getLine(y);
      if (line === undefined || y > first && !line.isWrapped)
        return;
      for (let x: number = 0; x < line.length; x++) {
        line.getCell(x, cell);
        const width: number = cell.getWidth();
        const chars: string = cell.getChars() === "" ? Resources.emptyCellText : cell.getChars();
        if (width > 0)
          for (const unit of chars.split("")) {
            length++;
            yield [unit, { x: x + 1, y: y + 1 }, { x: x + width, y: y + 1 }];
          }
      }
    }
  }

  private toLink(text: string, start: IBufferCellPosition, end: IBufferCellPosition): ILink {
    return {
      range: { start, end },
      text,
      activate: (event, url) => this.activate(event, url),
      hover: (_event, url) => this.hover(url),
      leave: () => this.hover(null)
    };
  }
}
