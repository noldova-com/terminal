/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CommandNotStartedException } from "../../src/exceptions/command-not-started.exception.ts";
import type { ICommandRunner } from "../../src/interfaces/i-command-runner.ts";
import { CommandRun } from "../../src/models/command-run.ts";

export class FakeCommandRunner implements ICommandRunner {
  public readonly runs: [string, readonly string[], number][] = [];
  public readonly answers: Map<string, string | Error | Promise<string>> = new Map<string, string | Error | Promise<string>>();
  public readonly environments: Readonly<Record<string, string>>[] = [];
  public readonly endings: number[] = [];
  public ended: Promise<void> = Promise.resolve();

  public start(file: string, args: readonly string[], timeoutMilliseconds: number, endMilliseconds: number,
    environment: Readonly<Record<string, string>> = {}): CommandRun {
    this.endings.push(endMilliseconds);
    return new CommandRun(this.runAsync(file, args, timeoutMilliseconds, environment), this.ended);
  }

  public async runAsync(file: string, args: readonly string[], timeoutMilliseconds: number, environment: Readonly<Record<string, string>> = {}): Promise<string> {
    this.runs.push([file, args, timeoutMilliseconds]);
    this.environments.push(environment);
    const answer: string | Error | Promise<string> | undefined = this.answers.get(file);
    if (answer === undefined)
      throw new CommandNotStartedException(file, new Error("not found"));
    if (answer instanceof Error)
      throw answer;
    return answer;
  }
}
