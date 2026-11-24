/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.ts";
import { TerminalException } from "./terminal.exception.ts";

export class StoredLinesDamagedException extends TerminalException {
  public constructor(cause?: unknown) {
    super(Resources.storedLinesDamaged, Object.isUndefined(cause) ? undefined : new ExceptionOptions(cause));
  }
}
