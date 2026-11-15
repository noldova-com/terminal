/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessResult } from "../models/process-result.ts";
import type { ProcessRunner } from "./process-runner.ts";
import { NpmUnavailableException } from "../exceptions/npm-unavailable.exception.ts";
import { Resources } from "../resources.ts";

export class NpmCommand {
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(runner: ProcessRunner, environment: NodeJS.ProcessEnv) {
    this.runner = runner;
    this.environment = environment;
  }

  public async runAsync(npmArguments: readonly string[], directory: string): Promise<ProcessResult> {
    const npm = this.environment[Resources.npmPathVariable];
    if (npm === undefined || npm.length === 0)
      throw new NpmUnavailableException();
    return this.runner.captureAsync(process.execPath, [npm, ...npmArguments], directory, Resources.npmTimeout);
  }
}
