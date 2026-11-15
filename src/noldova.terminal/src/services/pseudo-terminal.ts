/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalSize } from "@noldova/terminal.protocol";

import type { IPseudoTerminalListener } from "../interfaces/i-pseudo-terminal-listener.ts";
import type { IPtyExitEvent } from "../interfaces/i-pty-exit-event.ts";
import type { IPtyProcess } from "../interfaces/i-pty-process.ts";

export class PseudoTerminal {
  private readonly process: IPtyProcess;
  private readonly listener: IPseudoTerminalListener;
  private hasExited: boolean = false;
  private isEnding: boolean = false;

  public constructor(process: IPtyProcess, listener: IPseudoTerminalListener) {
    this.process = process;
    this.listener = listener;
    this.process.onData(t => this.listener.onData(t));
    this.process.onExit(t => {
      this.hasExited = true;
      if (!this.isEnding)
        void this.endAsync();
      this.listener.onExit(PseudoTerminal.toExitCode(t));
    });
  }

  public get pid(): number | null {
    return this.process.pid;
  }

  public write(data: string): void {
    if (!this.hasExited)
      this.process.write(data);
  }

  public resize(size: TerminalSize): void {
    if (!this.hasExited)
      this.process.resize(size.columns, size.rows);
  }

  public async readForegroundProcessGroupAsync(): Promise<number | null> {
    return this.hasExited ? null : await this.process.readForegroundProcessGroupAsync();
  }

  public pause(): void {
    if (!this.hasExited && !this.isEnding)
      this.process.pause();
  }

  public resume(): void {
    if (!this.hasExited)
      this.process.resume();
  }

  public endAsync(): Promise<boolean> {
    this.isEnding = true;
    this.resume();
    return this.process.endAsync();
  }

  private static toExitCode(event: IPtyExitEvent): number | null {
    return event.signal === undefined || event.signal === 0 ? event.exitCode ?? null : null;
  }
}
