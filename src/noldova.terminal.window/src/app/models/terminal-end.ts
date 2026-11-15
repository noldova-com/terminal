/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalEndedBy } from "../enums/terminal-ended-by.ts";

export class TerminalEnd {
  public readonly endedBy: TerminalEndedBy;
  public readonly exitCode: number | null;

  public constructor(endedBy: TerminalEndedBy, exitCode: number | null) {
    this.endedBy = endedBy;
    this.exitCode = exitCode;
  }
}
