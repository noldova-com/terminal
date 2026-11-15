/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalRunOutcome } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";
import { TerminalWindowException } from "./terminal-window.exception.ts";

export class TerminalRunNotTypedException extends TerminalWindowException {
  public override readonly name: string = "TerminalRunNotTypedException";
  public readonly sessionId: string;
  public readonly reason: TerminalRunOutcome;

  public constructor(sessionId: string, reason: TerminalRunOutcome) {
    super(Resources.formatRunNotTyped(sessionId, reason));

    this.sessionId = sessionId;
    this.reason = reason;
  }
}
