/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";
import { TerminalLaunchRefusedException } from "./terminal-launch-refused.exception.ts";

export class LaunchRowsRefusedException extends TerminalLaunchRefusedException {
  public override readonly name: string = "LaunchRowsRefusedException";
  public override readonly parameter: string = Resources.minimumRowsArgument;
  public readonly maximum: number;

  public constructor(maximum: number) {
    super(Resources.formatLaunchRefused(Resources.formatLaunchMinimumRowsRefused(maximum)));

    this.maximum = maximum;
  }
}
