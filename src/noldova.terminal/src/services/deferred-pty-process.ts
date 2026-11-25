/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { ForegroundProcess } from "@noldova/desktop.runtime";

import type { IDisposable } from "../interfaces/i-disposable.ts";
import type { IPtyExitEvent } from "../interfaces/i-pty-exit-event.ts";
import type { IPtyProcess } from "../interfaces/i-pty-process.ts";

export class DeferredPtyProcess implements IPtyProcess {
  private readonly dataListeners: Set<(data: string) => void> = new Set();
  private readonly exitListeners: Set<(event: IPtyExitEvent) => void> = new Set();
  private readonly startProcessAsync: (columns: number, rows: number) => Promise<IPtyProcess>;
  private process: IPtyProcess | undefined;
  private starting: Promise<void> | undefined;
  private columns: number;
  private rows: number;
  private isPaused: boolean = false;
  private isEnded: boolean = false;
  private hasExited: boolean = false;

  public constructor(startProcessAsync: (columns: number, rows: number) => Promise<IPtyProcess>, columns: number, rows: number) {
    this.startProcessAsync = startProcessAsync;
    this.columns = columns;
    this.rows = rows;
    this.process = undefined;
    this.starting = undefined;
  }

  public get hasStarted(): boolean {
    return !Object.isUndefined(this.starting);
  }

  public get pid(): number | null {
    return this.process?.pid ?? null;
  }

  public onData(listener: (data: string) => void): IDisposable {
    this.dataListeners.add(listener);
    return { dispose: () => this.dataListeners.delete(listener) };
  }

  public onExit(listener: (event: IPtyExitEvent) => void): IDisposable {
    this.exitListeners.add(listener);
    return { dispose: () => this.exitListeners.delete(listener) };
  }

  public write(data: string): void {
    this.process?.write(data);
  }

  public resize(columns: number, rows: number): void {
    this.columns = columns;
    this.rows = rows;
    if (Object.isUndefined(this.process))
      this.start();
    else
      this.process.resize(columns, rows);
  }

  public pause(): void {
    this.isPaused = true;
    this.process?.pause();
  }

  public resume(): void {
    this.isPaused = false;
    this.process?.resume();
  }

  public readForegroundProcessAsync(): Promise<ForegroundProcess | null> {
    return this.process?.readForegroundProcessAsync() ?? Promise.resolve(null);
  }

  public async endAsync(): Promise<boolean> {
    this.isEnded = true;
    await this.starting;
    if (!Object.isUndefined(this.process))
      return this.process.endAsync();
    this.exit({ exitCode: undefined });
    return true;
  }

  public start(): void {
    if (!Object.isUndefined(this.starting) || this.isEnded)
      return;
    const columns: number = this.columns;
    const rows: number = this.rows;
    this.starting = this.startProcessAsync(columns, rows).then(process => {
      process.onData(t => {
        for (const listener of this.dataListeners)
          listener(t);
      });
      process.onExit(t => this.exit(t));
      if (this.isPaused)
        process.pause();
      if (this.columns !== columns || this.rows !== rows)
        process.resize(this.columns, this.rows);
      this.process = process;
    }, () => this.exit({ exitCode: undefined }));
  }

  private exit(event: IPtyExitEvent): void {
    if (this.hasExited)
      return;
    this.hasExited = true;
    for (const listener of this.exitListeners)
      listener(event);
  }
}
