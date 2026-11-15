/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExecutableLocator } from "./executable-locator.ts";
import type { ProcessResult } from "../models/process-result.ts";
import type { ProcessRunner } from "./process-runner.ts";
import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { Resources } from "../resources.ts";

export class Git {
  private readonly directory: string;
  private readonly runner: ProcessRunner;
  private readonly executable: string;

  public constructor(directory: string, runner: ProcessRunner) {
    this.directory = directory;
    this.runner = runner;
    this.executable = ExecutableLocator.locate(Resources.gitCommand);
  }

  public async readOutputAsync(gitArguments: readonly string[], exitCodes: readonly number[] = Resources.gitSuccessCodes): Promise<string> {
    const result = await this.executeAsync(gitArguments);
    if (!exitCodes.some(t => t === result.exitCode))
      throw new GitFailedException(gitArguments, result.exitCode, result.errorOutput.trim());
    return result.output;
  }

  private executeAsync(gitArguments: readonly string[]): Promise<ProcessResult> {
    return this.runner.captureAsync(this.executable, gitArguments, this.directory, Resources.gitTimeout);
  }
}
