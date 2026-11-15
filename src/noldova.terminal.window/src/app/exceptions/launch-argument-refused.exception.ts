/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";
import { TerminalLaunchRefusedException } from "./terminal-launch-refused.exception.ts";

export class LaunchArgumentRefusedException extends TerminalLaunchRefusedException {
  public override readonly name: string = "LaunchArgumentRefusedException";
  public override readonly parameter: string;
  public readonly reason: string;

  public constructor(parameterName: string, reason: string) {
    super(Resources.formatLaunchRefused(reason));

    this.parameter = parameterName;
    this.reason = reason;
  }
}
