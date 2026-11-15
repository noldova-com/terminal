/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";
import { TerminalWindowException } from "./terminal-window.exception.ts";

export class TerminalRunNotFoundException extends TerminalWindowException {
  public override readonly name: string = "TerminalRunNotFoundException";
  public readonly sessionId: string;
  public readonly runId: string;

  public constructor(sessionId: string, runId: string) {
    super(Resources.formatRunNotFound(sessionId, runId));

    this.sessionId = sessionId;
    this.runId = runId;
  }
}
