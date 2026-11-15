/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalRunEndedBy } from "@noldova/terminal.protocol";

export class TerminalRunEnd {
  public readonly endedBy: TerminalRunEndedBy;
  public readonly exitCode: number | null;

  public constructor(endedBy: TerminalRunEndedBy, exitCode: number | null) {
    this.endedBy = endedBy;
    this.exitCode = exitCode;
  }
}
