/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { CommandFailedException } from "./command-failed.exception.ts";

export class CommandTimedOutException extends CommandFailedException {
  public readonly command: string;
  public readonly timeoutMilliseconds: number;

  public constructor(command: string, timeoutMilliseconds: number) {
    super(Resources.formatCommandTimedOut(command, timeoutMilliseconds));

    this.command = command;
    this.timeoutMilliseconds = timeoutMilliseconds;
  }
}
