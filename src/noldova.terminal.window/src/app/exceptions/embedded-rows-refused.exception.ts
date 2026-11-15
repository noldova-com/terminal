/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";
import { TerminalWindowException } from "./terminal-window.exception.ts";

export class EmbeddedRowsRefusedException extends TerminalWindowException {
  public override readonly name: string = "EmbeddedRowsRefusedException";
  public readonly rows: number;
  public readonly minimum: number;
  public readonly maximum: number;

  public constructor(rows: number, minimum: number, maximum: number) {
    super(Resources.formatEmbeddedRowsRefused(rows, minimum, maximum));

    this.rows = rows;
    this.minimum = minimum;
    this.maximum = maximum;
  }
}
