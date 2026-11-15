/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";

import { TerminalWindowException } from "./terminal-window.exception.ts";

export abstract class TerminalLaunchRefusedException extends TerminalWindowException {
  public override readonly name: string = "TerminalLaunchRefusedException";
  public abstract readonly parameter: string;

  protected constructor(message: string, options?: ExceptionOptions) {
    super(message, options);
  }
}
