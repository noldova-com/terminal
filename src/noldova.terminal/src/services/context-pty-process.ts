/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { constants } from "node:os";

import type { ForegroundProcess, PseudoTerminal, PseudoTerminalExit, Registration } from "@noldova/desktop.runtime";

import type { IDisposable } from "../interfaces/i-disposable.ts";
import type { IPtyExitEvent } from "../interfaces/i-pty-exit-event.ts";
import type { IPtyProcess } from "../interfaces/i-pty-process.ts";

export class ContextPtyProcess implements IPtyProcess {
  private readonly terminal: PseudoTerminal;

  public constructor(terminal: PseudoTerminal) {
    this.terminal = terminal;
  }

  public get pid(): number {
    return this.terminal.processId;
  }

  public onData(listener: (data: string) => void): IDisposable {
    const early: string[] = [];
    let isHolding: boolean = true;
    let isListening: boolean = true;
    const registration: Registration = this.terminal.onOutput(t => {
      if (isHolding)
        early.push(t);
      else
        listener(t);
    });
    if (early.length === 0)
      isHolding = false;
    else
      queueMicrotask(() => {
        for (let text: string | undefined = early.shift(); !Object.isUndefined(text); text = early.shift())
          if (isListening)
            try {
              listener(text);
            }
            catch (error: unknown) {
              queueMicrotask(() => {
                throw error;
              });
            }
        isHolding = false;
      });
    return {
      dispose: () => {
        isListening = false;
        registration[Symbol.dispose]();
      }
    };
  }

  public onExit(listener: (event: IPtyExitEvent) => void): IDisposable {
    let isListening: boolean = true;
    void this.terminal.exited.then(t => {
      if (isListening)
        listener(ContextPtyProcess.toEvent(t));
    });
    return { dispose: () => isListening = false };
  }

  public write(data: string): void {
    this.terminal.write(data);
  }

  public resize(columns: number, rows: number): void {
    this.terminal.resize(columns, rows);
  }

  public readForegroundProcessAsync(): Promise<ForegroundProcess | null> {
    return this.terminal.readForegroundProcessAsync();
  }

  public pause(): void {
    this.terminal.pause();
  }

  public resume(): void {
    this.terminal.resume();
  }

  public endAsync(): Promise<boolean> {
    return this.terminal.stopAsync();
  }

  private static toEvent(exit: PseudoTerminalExit): IPtyExitEvent {
    return Object.isNull(exit.signal) ? { exitCode: exit.code ?? undefined } : { exitCode: undefined, signal: constants.signals[exit.signal] };
  }
}
