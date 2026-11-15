/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.ts";
import { CommandFailedException } from "./command-failed.exception.ts";

export class CommandNotStartedException extends CommandFailedException {
  public readonly command: string;

  public constructor(command: string, cause: unknown) {
    super(Resources.formatCommandNotStarted(command), new ExceptionOptions(cause));

    this.command = command;
  }
}
