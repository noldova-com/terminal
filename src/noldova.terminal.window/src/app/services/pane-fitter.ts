/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources as ProtocolResources, TerminalSize } from "@noldova/terminal.protocol";
import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";

export class PaneFitter {
  private readonly terminal: Terminal;
  private readonly fit: FitAddon;
  private readonly resized: (size: TerminalSize) => void;
  private readonly isSizing: () => boolean;
  private readonly fixedRows: () => number | null;
  private readonly isShown: () => boolean;
  private frame: number | null = null;
  private hasReported: boolean = false;

  public constructor(terminal: Terminal, fit: FitAddon, resized: (size: TerminalSize) => void, isSizing: () => boolean, fixedRows: () => number | null,
    isShown: () => boolean) {
    this.terminal = terminal;
    this.fit = fit;
    this.resized = resized;
    this.isSizing = isSizing;
    this.fixedRows = fixedRows;
    this.isShown = isShown;
  }

  public request(): void {
    if (this.frame === null)
      this.frame = requestAnimationFrame(() => this.fitNow());
  }

  public requestReport(): void {
    this.hasReported = false;
    this.request();
  }

  public dispose(): void {
    if (this.frame !== null)
      cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  private fitNow(): void {
    this.frame = null;
    if (!this.isSizing())
      return;
    const proposed: { cols: number; rows: number } | undefined = this.fit.proposeDimensions();
    const rows: number = proposed === undefined ? Number.NaN : this.fixedRows() ?? proposed.rows;
    if (proposed === undefined || !Number.isFinite(proposed.cols) || !Number.isFinite(rows)) {
      if (!this.hasReported && !this.isShown())
        this.report(new TerminalSize(this.terminal.cols, this.terminal.rows));
      return;
    }
    const size: TerminalSize = new TerminalSize(PaneFitter.clamp(proposed.cols, ProtocolResources.minimumColumns, ProtocolResources.maximumColumns),
      PaneFitter.clamp(rows, ProtocolResources.minimumRows, ProtocolResources.maximumRows));
    if (size.columns === this.terminal.cols && size.rows === this.terminal.rows && this.hasReported)
      return;
    this.report(size);
  }

  private static clamp(value: number, least: number, most: number): number {
    return Math.min(Math.max(value, least), most);
  }

  private report(size: TerminalSize): void {
    this.hasReported = true;
    this.terminal.resize(size.columns, size.rows);
    this.resized(size);
  }
}
