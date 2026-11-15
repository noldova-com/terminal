/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";
import { TerminalRunRefusedException } from "./terminal-run-refused.exception.ts";

export class RunPartInactiveException extends TerminalRunRefusedException {
  public override readonly name: string = "RunPartInactiveException";
  public override readonly parameter: string = Resources.contextArgument;

  public constructor() {
    super(Resources.formatRunRefused(Resources.terminalPartInactive));
  }
}
