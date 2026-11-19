/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalLinePage, TerminalLineRange, type TerminalAttachment, type TerminalSize, type WindowsPty } from "@noldova/terminal.protocol";
import type { IBuffer, Terminal } from "@xterm/xterm";

import { Resources } from "../../resources.ts";
import { StoredLinesWindow } from "../models/stored-lines-window.ts";
import type { TerminalConnection } from "./terminal-connection.ts";
import { TerminalLineEncoder } from "./terminal-line-encoder.ts";

export class TerminalPager {
  private readonly terminal: Terminal;
  private readonly onReset: (size: TerminalSize, windowsPty: WindowsPty | null) => void;
  private readonly log: (message: string) => void;
  private readonly pages: number;
  private readonly window: StoredLinesWindow;
  private drawPagesAsync: ((attachment: TerminalAttachment) => Promise<void>) | null = null;
  private drawing: Promise<void> = Promise.resolve();
  private followed: TerminalLineRange | null = null;
  private heldPastes: string[] | null = [];
  private isLoaded: boolean = false;
  private isAttached: boolean = true;
  private isRebuilding: boolean = false;
  private isReturning: boolean = false;

  public readonly connection: TerminalConnection;

  public constructor(terminal: Terminal, connection: TerminalConnection, onReset: (size: TerminalSize, windowsPty: WindowsPty | null) => void,
    log: (message: string) => void, pages: number) {
    this.terminal = terminal;
    this.connection = connection;
    this.onReset = onReset;
    this.log = log;
    this.pages = pages;
    this.window = new StoredLinesWindow(pages, new TerminalLineRange(0, 0));
  }

  public drawAsync(attachment: TerminalAttachment): Promise<void> {
    const drawPagesAsync: ((attachment: TerminalAttachment) => Promise<void>) | null = this.drawPagesAsync;
    this.drawPagesAsync = null;
    const drawing: Promise<void> = this.drawing.then(() => this.drawNowAsync(drawPagesAsync, attachment));
    this.drawing = drawing.catch(() => undefined);
    return drawing;
  }

  public write(data: string, written: () => void): void {
    if (this.isAttached)
      this.terminal.write(data, written);
    else
      written();
  }

  public get isLive(): boolean {
    return this.isAttached;
  }

  public follow(stored: TerminalLineRange): void {
    if (this.isRebuilding)
      this.followed = stored;
    else
      this.window.follow(stored);
  }

  public type(data: string): void {
    this.connection.input(data);
    if (this.isAttached)
      return;

    this.isReturning = true;
    if (!this.isRebuilding)
      void this.extendAsync(() => this.comeBackAsync());
  }

  public paste(text: string): void {
    if (this.heldPastes === null)
      this.terminal.paste(text);
    else
      this.heldPastes.push(text);
  }

  public scroll(viewportY: number): void {
    if (!this.isLoaded || this.isRebuilding)
      return;
    if (viewportY === 0 && this.window.hasOlder)
      void this.extendAsync(() => this.extendUpAsync());
    else if (!this.isAttached && viewportY >= this.terminal.buffer.active.baseY)
      void this.extendAsync(() => this.extendDownAsync());
  }

  private async drawNowAsync(drawPagesAsync: ((attachment: TerminalAttachment) => Promise<void>) | null, attachment: TerminalAttachment): Promise<void> {
    if (drawPagesAsync !== null) {
      try {
        await drawPagesAsync(attachment);
        return;
      }
      catch (error) {
        this.isReturning = false;
        this.log(Resources.formatPagingFailed(error));
      }
    }
    this.isLoaded = false;
    await this.writeAsync("");
    this.window.reset(attachment.stored);
    this.onReset(attachment.size, attachment.windowsPty);
    this.restoreModes(attachment);
    this.keepRows(0);
    this.terminal.write(attachment.snapshot + attachment.pending);
    this.isAttached = true;
    this.isLoaded = true;
  }

  private async extendAsync(operation: () => Promise<void>): Promise<void> {
    this.isRebuilding = true;
    try {
      await operation();
    }
    catch (error) {
      this.isReturning = false;
      this.log(Resources.formatPagingFailed(error));
    }
    finally {
      this.isRebuilding = false;
      if (this.followed !== null)
        this.window.follow(this.followed);
      this.followed = null;
    }
  }

  private async refreshAsync(drawPagesAsync: (attachment: TerminalAttachment) => Promise<void>): Promise<void> {
    this.drawPagesAsync = drawPagesAsync;
    try {
      await this.connection.refreshAsync();
    }
    finally {
      this.drawPagesAsync = null;
    }
  }

  private async extendUpAsync(): Promise<void> {
    const anchor: number = this.window.first;
    if (this.isAttached)
      await this.refreshAsync(async attachment => {
        await this.catchUpAsync(attachment.stored.end);
        await this.prependAsync(attachment, anchor);
      });
    else
      await this.prependAsync(null, anchor);
  }

  private async prependAsync(attachment: TerminalAttachment | null, anchor: number): Promise<void> {
    if (this.window.hasOlder) {
      const page: TerminalLinePage = await this.fetchPageAsync(Math.max(this.window.first - Resources.storedPageLines, this.window.stored.start), this.window.first);
      if (page.lines.length > 0) {
        const isDetached: boolean = this.window.prepend(page);
        await this.rebuildAsync(isDetached ? null : attachment, anchor, 0);
        return;
      }
      this.window.follow(page.stored);
    }
    if (attachment !== null)
      await this.rebuildAsync(attachment, anchor, 0);
  }

  private async extendDownAsync(): Promise<void> {
    let anchor: number = this.window.last;
    if (this.window.hasNewer) {
      const page: TerminalLinePage = await this.fetchPageAsync(this.window.last, Math.min(this.window.last + Resources.storedPageLines, this.window.stored.end));
      if (page.lines.length > 0) {
        anchor = page.start;
        this.window.append(page);
      }
      else
        this.window.follow(page.stored);
    }
    if (this.window.hasNewer) {
      await this.rebuildAsync(null, anchor, -this.terminal.rows);
      return;
    }
    await this.refreshAsync(async attachment => {
      if (attachment.stored.end === this.window.last)
        await this.rebuildAsync(attachment, anchor, -this.terminal.rows);
      else {
        this.window.follow(attachment.stored);
        await this.rebuildAsync(null, anchor, -this.terminal.rows);
      }
    });
  }

  private async comeBackAsync(): Promise<void> {
    await this.refreshAsync(async attachment => {
      this.window.reset(attachment.stored);
      await this.rebuildAsync(attachment, attachment.stored.end, Number.MAX_SAFE_INTEGER);
    });
  }

  private async catchUpAsync(end: number): Promise<void> {
    if (end - this.window.last > this.pages * Resources.storedPageLines)
      this.window.reset(new TerminalLineRange(this.window.stored.start, end, this.window.stored.dropped));
    while (this.window.last < end) {
      const page: TerminalLinePage = await this.fetchPageAsync(this.window.last, Math.min(this.window.last + Resources.storedPageLines, end));
      if (page.lines.length === 0)
        break;
      this.window.append(page);
    }
  }

  private async rebuildAsync(attachment: TerminalAttachment | null, anchor: number, offset: number): Promise<void> {
    await this.writeAsync("");
    if (attachment === null)
      this.terminal.reset();
    else {
      this.onReset(attachment.size, attachment.windowsPty);
      this.restoreModes(attachment);
    }
    this.keepRows(this.pagedRows());
    if (this.window.first === this.window.stored.start && this.window.stored.dropped > 0)
      await this.writeAsync(`${Resources.noteAttributes}${Resources.formatDroppedLines(this.window.stored.dropped)}${Resources.resetAttributes}${Resources.lineBreak}`);
    const pages: readonly TerminalLinePage[] = this.window.pages;
    let anchorRow: number = 0;
    for (const [index, page] of pages.entries()) {
      if (page.start === anchor)
        anchorRow = this.cursorRow();
      await this.writeAsync(TerminalLineEncoder.encode(page.lines, pages[index + 1]?.lines[0]?.isWrapped !== true));
    }
    if (anchor >= this.window.last)
      anchorRow = this.cursorRow();
    if (attachment === null)
      this.isAttached = false;
    else {
      await this.writeAsync(attachment.snapshot + attachment.pending);
      this.window.follow(attachment.stored);
      this.isAttached = true;
      this.isLoaded = true;
    }
    const bottom: number = this.terminal.buffer.active.baseY;
    this.terminal.scrollToLine(this.isReturning && this.isAttached ? bottom : Math.min(Math.max(0, anchorRow + offset), bottom));
    this.isReturning = this.isReturning && !this.isAttached;
  }

  private restoreModes(attachment: TerminalAttachment): void {
    const pastes: string[] = this.heldPastes ?? [];
    this.heldPastes = pastes;
    const tail: string = attachment.snapshot.slice(attachment.snapshot.search(Resources.modesTail));
    this.terminal.write((tail.match(Resources.inputModes) ?? []).join(""), () => {
      this.heldPastes = null;
      for (const text of pastes)
        this.terminal.paste(text);
    });
  }

  private pagedRows(): number {
    const columns: number = this.terminal.cols;
    let rows: number = 0;
    for (const page of this.window.pages)
      for (const line of page.lines)
        rows += Math.max(1, Math.ceil(TerminalPager.cells(line.text) / columns));
    return rows;
  }

  private static cells(text: string): number {
    let cells: number = 0;
    for (const character of text)
      cells += character.length > 1 || character.charCodeAt(0) >= Resources.wideCharacterStart ? Resources.wideCharacterCells : 1;
    return cells;
  }

  private keepRows(paged: number): void {
    const scrollback: number = Resources.scrollback + paged;
    if (this.terminal.options.scrollback !== scrollback)
      this.terminal.options.scrollback = scrollback;
  }

  private cursorRow(): number {
    const buffer: IBuffer = this.terminal.buffer.active;
    return buffer.baseY + buffer.cursorY;
  }

  private writeAsync(data: string): Promise<void> {
    return new Promise<void>(resolve => this.terminal.write(data, () => {
      if (!this.connection.isClosed)
        resolve();
    }));
  }

  private async fetchPageAsync(start: number, end: number): Promise<TerminalLinePage> {
    const page: TerminalLinePage = await this.connection.readLinesAsync(start, end - start);
    return new TerminalLinePage(page.start, page.lines.slice(0, Math.max(0, end - page.start)), page.stored);
  }
}
