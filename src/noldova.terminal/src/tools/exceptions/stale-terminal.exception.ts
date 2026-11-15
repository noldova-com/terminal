/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalException } from "../../exceptions/terminal.exception.ts";
import { Resources } from "../../resources.ts";

export class StaleTerminalException extends TerminalException {
  public readonly terminalId: string;

  public constructor(terminalId: string) {
    super(Resources.formatTerminalStale(terminalId));

    this.terminalId = terminalId;
  }
}
