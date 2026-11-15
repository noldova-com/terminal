/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalRunBusy } from "@noldova/terminal.protocol";

export class TerminalRunTarget {
  public readonly sessionId: string;
  public readonly whenBusy: TerminalRunBusy;

  public constructor(sessionId: string, whenBusy: TerminalRunBusy = TerminalRunBusy.Refuse) {
    this.sessionId = sessionId;
    this.whenBusy = whenBusy;
  }
}
