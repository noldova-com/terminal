/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CommandStatus } from "../enums/command-status.ts";
import type { RunMethod } from "../enums/run-method.ts";
import type { IOutputSource } from "./i-output-source.ts";

export interface IAgentCommand extends IOutputSource {
  readonly method: RunMethod;
  readonly status: CommandStatus;
  readonly exitCode: number | null;
  readonly cwd: string | null;
  readonly logFile: string;

  waitForEndAsync(timeoutMilliseconds: number, signal: AbortSignal): Promise<void>;

  interrupt(): boolean;
}
