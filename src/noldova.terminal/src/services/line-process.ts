/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { type IModuleLog, type IRuntimePartContext, type OwnedProcess, type ProcessExit, ProcessRequest, ProcessStartException } from "@noldova/desktop.runtime";

import type { ILineProcess } from "../interfaces/i-line-process.ts";
import type { ILineProcessListener } from "../interfaces/i-line-process-listener.ts";
import { Resources } from "../resources.ts";
import { FailureText } from "./failure-text.ts";

export class LineProcess implements ILineProcess {
  private readonly listener: ILineProcessListener;
  private readonly log: IModuleLog;
  private readonly name: string;
  private readonly stopping: AbortController = new AbortController();
  private readonly started: Promise<OwnedProcess | null>;
  private output: string = "";

  public constructor(context: IRuntimePartContext, file: string, args: readonly string[], listener: ILineProcessListener) {
    this.name = path.basename(file);
    this.listener = listener;
    this.log = context.log;
    this.started = Promise.resolve()
      .then(() => context.startProcessAsync(new ProcessRequest(file, [...args], path.dirname(file), {}, [], this.stopping.signal)))
      .then(t => this.attach(t), (error: unknown) => {
        this.refuse(error);
        return null;
      })
      .catch((error: unknown) => {
        this.report(error);
        return null;
      });
  }

  public write(line: string): void {
    void this.started.then(t => t?.input.write(`${line}${Resources.lineFeed}`));
  }

  public kill(): void {
    this.stopping.abort();
  }

  private attach(process: OwnedProcess): OwnedProcess {
    process.output.setEncoding(Resources.utf8Encoding);
    process.output.on(Resources.dataEvent, (text: string) => this.receive(text));
    process.errors.resume();
    process.input.on(Resources.lineProcessErrorEvent, (error: Error) => this.listener.onExit(FailureText.read(error)));
    const closed: Promise<void> = new Promise<void>(resolve => process.output.once(Resources.closeEvent, () => resolve()));
    void Promise.all([process.exited, closed])
      .then(([exit]: [ProcessExit, void]) => this.listener.onExit(Resources.formatProcessExited(this.name, exit.code ?? exit.signal)))
      .catch((error: unknown) => this.report(error));
    return process;
  }

  private refuse(error: unknown): void {
    if (this.stopping.signal.aborted && error === this.stopping.signal.reason) {
      this.listener.onExit(Resources.lineProcessStopped);
      return;
    }
    if (!(error instanceof ProcessStartException))
      this.report(error);
    this.listener.onExit(FailureText.read(error));
  }

  private report(error: unknown): void {
    this.log.write(Resources.formatLineProcessFailed(this.name, FailureText.read(error)));
  }

  private receive(text: string): void {
    const output: string = `${this.output}${text}`;
    const end: number = output.lastIndexOf(Resources.lineFeed) + 1;
    this.output = output.slice(end);
    for (const line of output.slice(0, end).split(Resources.lineFeed).slice(0, -1))
      this.listener.onLine(line.replace(Resources.lineProcessTrailingCarriageReturn, ""));
    if (this.output.length > Resources.maximumLineLength)
      this.kill();
  }
}
