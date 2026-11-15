/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";

import { ProcessNotStartedException } from "../exceptions/process-not-started.exception.ts";
import { ProcessOutputTooLongException } from "../exceptions/process-output-too-long.exception.ts";
import { ProcessTimeoutException } from "../exceptions/process-timeout.exception.ts";
import type { ProcessException } from "../exceptions/process.exception.ts";
import { ProcessResult } from "../models/process-result.ts";
import { Resources } from "../resources.ts";

export class ProcessRunner {
  public captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number, environment?: NodeJS.ProcessEnv): Promise<ProcessResult> {
    return new Promise<ProcessResult>((resolve, reject) => {
      const child = spawn(command, [...commandArguments], {
        cwd: directory,
        shell: false,
        stdio: [Resources.ignoredStdio, Resources.pipedStdio, Resources.pipedStdio],
        windowsHide: true,
        env: environment ?? process.env
      });
      const output: Buffer[] = [];
      const errorOutput: Buffer[] = [];
      let size = 0;
      let failure: ProcessException | null = null;
      const stop = (t: ProcessException): void => {
        failure ??= t;
        child.kill();
      };
      const receive = (chunks: Buffer[], chunk: Buffer): void => {
        size += chunk.length;
        if (size > Resources.outputLimit)
          stop(new ProcessOutputTooLongException(command, Resources.outputLimit));
        else
          chunks.push(chunk);
      };
      const timer = setTimeout(() => stop(new ProcessTimeoutException(command, timeout)), timeout);
      child.stdout.on("data", (t: Buffer) => receive(output, t));
      child.stderr.on("data", (t: Buffer) => receive(errorOutput, t));
      child.on("error", t => stop(new ProcessNotStartedException(command, t)));
      child.on("close", t => {
        clearTimeout(timer);
        if (failure === null)
          resolve(new ProcessResult(t, Buffer.concat(output).toString(Resources.textEncoding), Buffer.concat(errorOutput).toString(Resources.textEncoding)));
        else
          reject(failure);
      });
    });
  }

  public async runAsync(program: string, parameters: readonly string[], folder: string): Promise<number> {
    return await new Promise<number>((resolve, reject) => {
      const child = spawn(program, parameters, { cwd: folder, stdio: Resources.inheritedStdio });
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve(code ?? (signal === null ? 1 : Resources.signalExitCode)));
    });
  }
}
