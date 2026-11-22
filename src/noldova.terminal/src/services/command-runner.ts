/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { addAbortListener } from "node:events";
import path from "node:path";

import { type IRuntimePartContext, type OwnedProcess, type ProcessExit, ProcessRequest, ProcessStartException } from "@noldova/desktop.runtime";

import { CommandExitedException } from "../exceptions/command-exited.exception.ts";
import { CommandNotStartedException } from "../exceptions/command-not-started.exception.ts";
import { CommandOutputTooLongException } from "../exceptions/command-output-too-long.exception.ts";
import { CommandTimedOutException } from "../exceptions/command-timed-out.exception.ts";
import type { ICommandRunner } from "../interfaces/i-command-runner.ts";
import { CommandRun } from "../models/command-run.ts";
import { Resources } from "../resources.ts";

export class CommandRunner implements ICommandRunner {
  private readonly context: IRuntimePartContext;

  public constructor(context: IRuntimePartContext) {
    this.context = context;
  }

  public async runAsync(file: string, args: readonly string[], timeoutMilliseconds: number, environment: Readonly<Record<string, string>> = {}): Promise<string> {
    return await this.start(file, args, timeoutMilliseconds, timeoutMilliseconds, environment).answer;
  }

  public start(file: string, args: readonly string[], timeoutMilliseconds: number, endMilliseconds: number,
    environment: Readonly<Record<string, string>> = {}): CommandRun {
    const name: string = path.basename(file);
    const stopping: AbortController = new AbortController();
    const request: ProcessRequest = new ProcessRequest(file, [...args], path.dirname(file), environment, [], stopping.signal);
    const answer: PromiseWithResolvers<string> = Promise.withResolvers<string>();
    const late: NodeJS.Timeout = setTimeout(() => answer.reject(new CommandTimedOutException(name, timeoutMilliseconds)), timeoutMilliseconds);
    const ending: NodeJS.Timeout = setTimeout(() => stopping.abort(), Math.max(timeoutMilliseconds, endMilliseconds));
    const ended: Promise<void> = this.readAsync(name, request, stopping, timeoutMilliseconds, () => clearTimeout(late)).then(answer.resolve, answer.reject)
      .finally(() => {
        clearTimeout(late);
        clearTimeout(ending);
      });
    return new CommandRun(answer.promise, ended);
  }

  private async readAsync(name: string, request: ProcessRequest, stopping: AbortController, timeoutMilliseconds: number, exited: () => void): Promise<string> {
    let process: OwnedProcess;
    try {
      process = await this.context.startProcessAsync(request);
    }
    catch (error: unknown) {
      if (stopping.signal.aborted && error === stopping.signal.reason)
        throw new CommandTimedOutException(name, timeoutMilliseconds);
      if (!(error instanceof ProcessStartException))
        throw error;
      throw new CommandNotStartedException(name, error);
    }
    addAbortListener(stopping.signal, () => {
      process.output.destroy();
      process.errors.destroy();
    });
    let isTooLong: boolean = false;
    let output: string = "";
    process.output.setEncoding(Resources.utf8Encoding);
    process.output.on(Resources.dataEvent, (text: string) => {
      output += text;
      if (output.length > Resources.maximumCommandOutputLength) {
        isTooLong = true;
        stopping.abort();
      }
    });
    let errors: string = "";
    process.errors.setEncoding(Resources.utf8Encoding);
    process.errors.on(Resources.dataEvent, (text: string) => {
      errors = (errors + text).slice(-Resources.maximumCommandErrorLength);
    });
    const closed: Promise<void> = new Promise<void>(resolve => process.output.once(Resources.closeEvent, () => resolve()));
    const errorsClosed: Promise<void> = new Promise<void>(resolve => process.errors.once(Resources.closeEvent, () => resolve()));
    const exit: ProcessExit = await process.exited.finally(exited);
    await Promise.all([closed, errorsClosed]);
    if (isTooLong)
      throw new CommandOutputTooLongException(name, Resources.maximumCommandOutputLength);
    if (stopping.signal.aborted)
      throw new CommandTimedOutException(name, timeoutMilliseconds);
    if (exit.code !== 0)
      throw new CommandExitedException(name, exit, errors);
    return output;
  }
}
