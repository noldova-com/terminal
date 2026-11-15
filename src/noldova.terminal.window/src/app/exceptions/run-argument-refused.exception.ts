/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";
import { TerminalRunRefusedException } from "./terminal-run-refused.exception.ts";

export class RunArgumentRefusedException extends TerminalRunRefusedException {
  public override readonly name: string = "RunArgumentRefusedException";
  public override readonly parameter: string;
  public readonly reason: string;

  public constructor(parameterName: string, reason: string) {
    super(Resources.formatRunRefused(reason));

    this.parameter = parameterName;
    this.reason = reason;
  }
}
