/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ILineProcessListener } from "../../src/interfaces/i-line-process-listener.ts";
import type { ILineProcessStarter } from "../../src/interfaces/i-line-process-starter.ts";
import type { ILineProcess } from "../../src/interfaces/i-line-process.ts";

export class FakeLineProcess implements ILineProcess {
  public readonly file: string;
  public readonly args: readonly string[];
  public readonly written: string[] = [];
  public killed: boolean = false;
  private readonly listener: ILineProcessListener;

  public constructor(file: string, args: readonly string[], listener: ILineProcessListener) {
    this.file = file;
    this.args = args;
    this.listener = listener;
  }

  public write(line: string): void {
    this.written.push(line);
  }

  public kill(): void {
    this.killed = true;
  }

  public answer(value: unknown): void {
    this.listener.onLine(`${Buffer.from(JSON.stringify(value), "utf8").toString("base64")}\r`);
  }

  public reply(machine: Readonly<Record<string, readonly [string, boolean]>>, user: Readonly<Record<string, readonly [string, boolean]>>): void {
    this.answer({ id: this.written.at(-1), machine, user });
  }

  public line(line: string): void {
    this.listener.onLine(line);
  }

  public exit(reason: string): void {
    this.listener.onExit(reason);
  }
}

export class FakeLineProcessStarter implements ILineProcessStarter {
  public readonly started: FakeLineProcess[] = [];

  public get last(): FakeLineProcess {
    const process: FakeLineProcess | undefined = this.started.at(-1);
    if (process === undefined)
      throw new Error("No process has started.");
    return process;
  }

  public start(file: string, args: readonly string[], listener: ILineProcessListener): ILineProcess {
    const process: FakeLineProcess = new FakeLineProcess(file, args, listener);
    this.started.push(process);
    return process;
  }
}
