/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalRunEndedBy } from "@noldova/terminal.protocol";

import { TerminalRunEnd } from "./terminal-run-end.ts";

export class TerminalRun {
  public readonly sessionId: string;
  public readonly runId: string;
  public readonly ended: Promise<TerminalRunEnd>;

  public constructor(sessionId: string, runId: string, ended: Promise<TerminalRunEnd> = Promise.resolve(new TerminalRunEnd(TerminalRunEndedBy.TerminalEnded, null))) {
    this.sessionId = sessionId;
    this.runId = runId;
    this.ended = ended;
  }
}
