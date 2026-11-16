/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CommandRun } from "../models/command-run.ts";

export interface ICommandRunner {
  runAsync(file: string, args: readonly string[], timeoutMilliseconds: number, environment?: Readonly<Record<string, string>>): Promise<string>;
  start(file: string, args: readonly string[], timeoutMilliseconds: number, endMilliseconds: number, environment?: Readonly<Record<string, string>>): CommandRun;
}
