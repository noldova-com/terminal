/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalEndedBy } from "../enums/terminal-ended-by.ts";
import { TerminalEnd } from "../models/terminal-end.ts";

export class TerminalLaunchEnds {
  private static readonly pending: Map<string, (end: TerminalEnd) => void> = new Map<string, (end: TerminalEnd) => void>();

  public static add(sessionId: string, finish: (end: TerminalEnd) => void): void {
    TerminalLaunchEnds.pending.set(sessionId, finish);
  }

  public static remove(sessionId: string): void {
    TerminalLaunchEnds.pending.delete(sessionId);
  }

  public static detachAll(): void {
    for (const finish of [...TerminalLaunchEnds.pending.values()])
      finish(new TerminalEnd(TerminalEndedBy.Detach, null));
  }
}
