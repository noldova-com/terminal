/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { CommandFailedException } from "./command-failed.exception.ts";

export class CommandOutputTooLongException extends CommandFailedException {
  public readonly command: string;
  public readonly limit: number;

  public constructor(command: string, limit: number) {
    super(Resources.formatCommandOutputTooLong(command));

    this.command = command;
    this.limit = limit;
  }
}
