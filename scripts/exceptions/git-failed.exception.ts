/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ProcessException } from "./process.exception.ts";

export class GitFailedException extends ProcessException {
  public readonly gitArguments: readonly string[];
  public readonly exitCode: number | null;
  public readonly errorOutput: string;

  public constructor(gitArguments: readonly string[], exitCode: number | null, errorOutput: string) {
    super(Resources.formatGitFailed(gitArguments, exitCode, errorOutput));

    this.gitArguments = gitArguments;
    this.exitCode = exitCode;
    this.errorOutput = errorOutput;
  }
}
