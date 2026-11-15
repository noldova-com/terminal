/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessExit } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";
import { CommandFailedException } from "./command-failed.exception.ts";

export class CommandExitedException extends CommandFailedException {
  public readonly command: string;
  public readonly exitCode: number | null;
  public readonly signal: NodeJS.Signals | null;

  public constructor(command: string, exit: ProcessExit) {
    super(Resources.formatCommandExited(command, exit.code, exit.signal));

    this.command = command;
    this.exitCode = exit.code;
    this.signal = exit.signal;
  }
}
