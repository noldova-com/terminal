/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.ts";
import { ShellsUnreadableException } from "./shells-unreadable.exception.ts";

export class WslDistributionsUnreadableException extends ShellsUnreadableException {
  public constructor(cause?: unknown) {
    super(Resources.wslDistributionsUnreadable, new ExceptionOptions(cause));
  }
}
