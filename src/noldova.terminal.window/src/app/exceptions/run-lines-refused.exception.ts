/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";
import { TerminalWindowException } from "./terminal-window.exception.ts";

export class RunLinesRefusedException extends TerminalWindowException {
  public override readonly name: string = "RunLinesRefusedException";
  public readonly lines: number;
  public readonly maximum: number;

  public constructor(lines: number, maximum: number) {
    super(Resources.formatRunLinesRefused(lines, maximum));

    this.lines = lines;
    this.maximum = maximum;
  }
}
