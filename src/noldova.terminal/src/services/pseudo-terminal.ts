/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ForegroundProcess } from "@noldova/desktop.runtime";
import type { TerminalSize } from "@noldova/terminal.protocol";

import type { IPseudoTerminalListener } from "../interfaces/i-pseudo-terminal-listener.ts";
import type { IPtyExitEvent } from "../interfaces/i-pty-exit-event.ts";
import type { IPtyProcess } from "../interfaces/i-pty-process.ts";
import { Resources } from "../resources.ts";

export class PseudoTerminal {
  private readonly process: IPtyProcess;
  private readonly listener: IPseudoTerminalListener;
  private readonly isConPty: boolean;
  private readonly holdsKeysAfterResize: boolean;
  private readonly heldKeys: string[] = [];
  private isResized: boolean = false;
  private resizeHold: NodeJS.Timeout | undefined = undefined;
  private hasExited: boolean = false;
  private isEnding: boolean = false;
  private openRequests: number = 0;
  private outputEnd: string = "";
  private answerLimit: NodeJS.Timeout | undefined = undefined;

  public constructor(process: IPtyProcess, listener: IPseudoTerminalListener, isConPty: boolean = false, holdsKeysAfterResize: boolean = false) {
    this.process = process;
    this.listener = listener;
    this.isConPty = isConPty;
    this.holdsKeysAfterResize = holdsKeysAfterResize;
    this.process.onData(t => {
      if (this.isConPty)
        this.watchCursorRequests(t);
      this.listener.onData(t);
    });
    this.process.onExit(t => {
      this.hasExited = true;
      clearTimeout(this.resizeHold);
      this.resizeHold = undefined;
      this.releaseKeys();
      if (!this.isEnding)
        void this.endAsync();
      this.listener.onExit(PseudoTerminal.toExitCode(t));
    });
  }

  public get pid(): number | null {
    return this.process.pid;
  }

  public write(data: string): void {
    if (this.hasExited)
      return;
    if (this.openRequests > 0 || this.resizeHold !== undefined)
      this.heldKeys.push(data);
    else if (this.isResized)
      this.leadIn(data);
    else
      this.process.write(data);
  }

  public answer(data: string): void {
    if (this.hasExited)
      return;
    this.process.write(data);
    if (this.openRequests === 0)
      return;
    this.openRequests = Math.max(0, this.openRequests - (data.match(Resources.cursorAnswers) ?? []).length);
    if (this.openRequests === 0)
      this.releaseKeys();
  }

  public resize(size: TerminalSize): void {
    if (this.hasExited)
      return;
    this.process.resize(size.columns, size.rows);
    this.isResized = this.holdsKeysAfterResize;
  }

  public async readForegroundProcessAsync(): Promise<ForegroundProcess | null> {
    return this.hasExited ? null : await this.process.readForegroundProcessAsync();
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

  private watchCursorRequests(data: string): void {
    const text: string = this.outputEnd + data;
    const requests: number = text.split(Resources.cursorRequest).length - 1;
    this.outputEnd = text.slice(1 - Resources.cursorRequest.length);
    if (requests === 0)
      return;
    clearTimeout(this.answerLimit);
    this.answerLimit = setTimeout(() => this.releaseKeys(), Resources.cursorAnswerMilliseconds);
    this.openRequests += requests;
  }

  private leadIn(data: string): void {
    this.isResized = false;
    this.process.write(Resources.resizeLeadIn);
    this.heldKeys.push(data);
    this.resizeHold = setTimeout(() => {
      this.resizeHold = undefined;
      if (this.openRequests === 0)
        this.writeHeldKeys();
    }, Resources.resizeKeyHoldMilliseconds);
  }

  private releaseKeys(): void {
    clearTimeout(this.answerLimit);
    this.answerLimit = undefined;
    this.openRequests = 0;
    this.writeHeldKeys();
  }

  private writeHeldKeys(): void {
    for (const key of this.heldKeys.splice(0))
      this.write(key);
  }

  private static toExitCode(event: IPtyExitEvent): number | null {
    return event.signal === undefined || event.signal === 0 ? event.exitCode ?? null : null;
  }
}
