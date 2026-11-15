/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { inspect } from "node:util";

import { TerminalException } from "../../exceptions/terminal.exception.ts";
import { Resources } from "../../resources.ts";

export class AbortReasonUnknownException extends TerminalException {
  public readonly reason: unknown;

  public constructor(reason: unknown) {
    super(Resources.formatAbortReasonUnknown(inspect(reason)));

    this.reason = reason;
  }
}
