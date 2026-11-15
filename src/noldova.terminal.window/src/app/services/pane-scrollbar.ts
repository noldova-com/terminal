/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IBuffer, IDisposable, Terminal } from "@xterm/xterm";

import { Resources } from "../../resources.ts";

export class PaneScrollbar {
  private readonly terminal: Terminal;
  private readonly bar: HTMLElement;
  private readonly range: HTMLElement;
  private readonly subscriptions: readonly IDisposable[];
  private readonly scrolled = (): void => this.follow();
  private readonly focused = (): void => this.terminal.focus();

  public constructor(terminal: Terminal, bar: HTMLElement) {
    this.terminal = terminal;
    this.bar = bar;
    this.range = document.createElement(Resources.scrollbarRangeTag);
    bar.replaceChildren(this.range);
    this.subscriptions = [
      terminal.onScroll(() => this.sync()),
      terminal.onResize(() => this.sync()),
      terminal.onWriteParsed(() => this.sync()),
      terminal.buffer.onBufferChange(() => this.sync())
    ];
    bar.addEventListener(Resources.scrollEvent, this.scrolled, { passive: true });
    bar.addEventListener(Resources.focusEvent, this.focused);
    this.sync();
  }

  public sync(): void {
    const buffer: IBuffer = this.terminal.buffer.active;
    const row: number = this.bar.clientHeight / this.terminal.rows;
    const height: string = Resources.formatPixels(row * buffer.length);
    if (this.range.style.height !== height)
      this.range.style.height = height;
    if (row > 0 && Math.round(this.bar.scrollTop / row) !== buffer.viewportY)
      this.bar.scrollTop = buffer.viewportY * row;
  }

  public dispose(): void {
    for (const subscription of this.subscriptions)
      subscription.dispose();
    this.bar.removeEventListener(Resources.scrollEvent, this.scrolled);
    this.bar.removeEventListener(Resources.focusEvent, this.focused);
  }

  private follow(): void {
    const row: number = this.bar.clientHeight / this.terminal.rows;
    if (row === 0)
      return;
    const line: number = Math.round(this.bar.scrollTop / row);
    if (line !== this.terminal.buffer.active.viewportY)
      this.terminal.scrollToLine(line);
  }
}
