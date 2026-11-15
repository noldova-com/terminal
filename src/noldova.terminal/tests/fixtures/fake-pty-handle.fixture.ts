/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPseudoTerminalHandle } from "@noldova/desktop.runtime";

import type { IDisposable } from "../../src/interfaces/i-disposable.ts";
import type { IPtyExitEvent } from "../../src/interfaces/i-pty-exit-event.ts";

export class FakePtyHandle implements IPseudoTerminalHandle {
  private readonly dataListeners: Set<(data: string) => void> = new Set<(data: string) => void>();
  private readonly exitListeners: Set<(event: IPtyExitEvent) => void> = new Set<(event: IPtyExitEvent) => void>();
  private readonly reading: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  public readonly pid: number;
  public readonly writes: string[] = [];
  public readonly answers: Map<string, string> = new Map<string, string>();
  public readonly sizes: string[] = [];
  public readonly kills: string[] = [];
  public pauses: number = 0;
  public resumes: number = 0;
  public exitsOn: readonly string[] = ["default", "SIGHUP", "SIGKILL"];

  public constructor(pid: number = 4_242) {
    this.pid = pid;
  }

  public get isRead(): boolean {
    return this.dataListeners.size > 0;
  }

  public waitUntilReadAsync(): Promise<void> {
    return this.reading.promise;
  }

  public onData(listener: (data: string) => void): IDisposable {
    this.dataListeners.add(listener);
    this.reading.resolve();
    return { dispose: () => this.dataListeners.delete(listener) };
  }

  public onExit(listener: (event: IPtyExitEvent) => void): IDisposable {
    this.exitListeners.add(listener);
    return { dispose: () => this.exitListeners.delete(listener) };
  }

  public write(data: string): void {
    this.writes.push(data);
    const answer: string | undefined = this.answers.get(data);
    if (answer !== undefined)
      this.emitData(answer);
  }

  public resize(columns: number, rows: number): void {
    this.sizes.push(`${columns}x${rows}`);
  }

  public pause(): void {
    this.pauses++;
  }

  public resume(): void {
    this.resumes++;
  }

  public kill(signal?: string): void {
    const name: string = signal ?? "default";
    this.kills.push(name);
    if (this.exitsOn.includes(name))
      this.exit(signal === undefined ? 1 : 0, signal === undefined ? 0 : 1);
  }

  public emitData(data: string): void {
    for (const listener of this.dataListeners)
      listener(data);
  }

  public exit(exitCode: number | undefined, signal?: number): void {
    const event: IPtyExitEvent = signal === undefined ? { exitCode } : { exitCode, signal };
    for (const listener of this.exitListeners)
      listener(event);
  }
}
