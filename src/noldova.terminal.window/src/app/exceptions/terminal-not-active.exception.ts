/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";
import { TerminalWindowException } from "./terminal-window.exception.ts";

export class TerminalNotActiveException extends TerminalWindowException {
  public override readonly name: string = "TerminalNotActiveException";

  public constructor() {
    super(Resources.terminalNotActive);
  }
}
