/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ProcessException } from "./process.exception.ts";

export class ProcessOutputTooLongException extends ProcessException {
  public readonly command: string;
  public readonly limit: number;

  public constructor(command: string, limit: number) {
    super(Resources.formatProcessOutputTooLong(command, limit));

    this.command = command;
    this.limit = limit;
  }
}
