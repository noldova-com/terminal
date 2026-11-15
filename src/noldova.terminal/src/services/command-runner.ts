/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { type IRuntimePartContext, type OwnedProcess, type ProcessExit, ProcessRequest, ProcessStartException } from "@noldova/desktop.runtime";

import { CommandExitedException } from "../exceptions/command-exited.exception.ts";
import { CommandNotStartedException } from "../exceptions/command-not-started.exception.ts";
import { CommandOutputTooLongException } from "../exceptions/command-output-too-long.exception.ts";
import { CommandTimedOutException } from "../exceptions/command-timed-out.exception.ts";
import type { ICommandRunner } from "../interfaces/i-command-runner.ts";
import { Resources } from "../resources.ts";

export class CommandRunner implements ICommandRunner {
  private readonly context: IRuntimePartContext;

  public constructor(context: IRuntimePartContext) {
    this.context = context;
  }

  public async runAsync(file: string, args: readonly string[], timeoutMilliseconds: number, environment: Readonly<Record<string, string>> = {}): Promise<string> {
    const name: string = path.basename(file);
    const stopping: AbortController = new AbortController();
    const request: ProcessRequest = new ProcessRequest(file, [...args], path.dirname(file), environment, [], stopping.signal);
    let isTooLong: boolean = false;
    const timer: NodeJS.Timeout = setTimeout(() => stopping.abort(), timeoutMilliseconds);
    try {
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
      let output: string = "";
      process.output.setEncoding(Resources.utf8Encoding);
      process.output.on(Resources.dataEvent, (text: string) => {
        output += text;
        if (output.length > Resources.maximumCommandOutputLength) {
          isTooLong = true;
          stopping.abort();
        }
      });
      process.errors.resume();
      const closed: Promise<void> = new Promise<void>(resolve => process.output.once(Resources.closeEvent, () => resolve()));
      const [exit]: [ProcessExit, void] = await Promise.all([process.exited.finally(() => clearTimeout(timer)), closed]);
      if (isTooLong)
        throw new CommandOutputTooLongException(name, Resources.maximumCommandOutputLength);
      if (stopping.signal.aborted)
        throw new CommandTimedOutException(name, timeoutMilliseconds);
      if (exit.code !== 0)
        throw new CommandExitedException(name, exit);
      return output;
    }
    finally {
      clearTimeout(timer);
    }
  }
}
