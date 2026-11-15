/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ProcessException } from "./process.exception.ts";

export class ProcessTimeoutException extends ProcessException {
  public readonly command: string;
  public readonly timeout: number;

  public constructor(command: string, timeout: number) {
    super(Resources.formatProcessTimedOut(command, timeout));

    this.command = command;
    this.timeout = timeout;
  }
}
