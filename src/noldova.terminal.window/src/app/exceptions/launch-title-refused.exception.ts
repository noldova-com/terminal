/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";
import { TerminalLaunchRefusedException } from "./terminal-launch-refused.exception.ts";

export class LaunchTitleRefusedException extends TerminalLaunchRefusedException {
  public override readonly name: string = "LaunchTitleRefusedException";
  public override readonly parameter: string = Resources.titleArgument;
  public readonly maximumLength: number;

  public constructor(maximumLength: number) {
    super(Resources.formatLaunchRefused(Resources.formatLaunchTitleRefused(maximumLength)));

    this.maximumLength = maximumLength;
  }
}
