/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ReadCursor } from "./read-cursor.ts";

export class ReadCursors {
  private readonly bySession: Map<string, Map<string, ReadCursor>> = new Map<string, Map<string, ReadCursor>>();

  public find(agentSessionId: string, terminalId: string): ReadCursor | undefined {
    return this.bySession.get(agentSessionId)?.get(terminalId);
  }

  public set(agentSessionId: string, terminalId: string, cursor: ReadCursor): void {
    const cursors: Map<string, ReadCursor> = this.bySession.get(agentSessionId) ?? new Map<string, ReadCursor>();
    cursors.set(terminalId, cursor);
    this.bySession.set(agentSessionId, cursors);
  }

  public forgetTerminal(terminalId: string): void {
    for (const cursors of this.bySession.values())
      cursors.delete(terminalId);
  }

  public forgetSession(agentSessionId: string): void {
    this.bySession.delete(agentSessionId);
  }
}
