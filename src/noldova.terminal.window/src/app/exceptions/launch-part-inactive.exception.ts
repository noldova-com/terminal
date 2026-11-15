/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";
import { TerminalLaunchRefusedException } from "./terminal-launch-refused.exception.ts";

export class LaunchPartInactiveException extends TerminalLaunchRefusedException {
  public override readonly name: string = "LaunchPartInactiveException";
  public override readonly parameter: string = Resources.contextArgument;

  public constructor() {
    super(Resources.formatLaunchRefused(Resources.terminalPartInactive));
  }
}
