/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalDockGrowth } from "../models/terminal-dock-growth.ts";

export class TerminalDockGrowths {
  private static readonly asks: Map<string, TerminalDockGrowth> = new Map<string, TerminalDockGrowth>();

  public static ask(sessionId: string, rows: number): () => void {
    const growth: TerminalDockGrowth = new TerminalDockGrowth(rows);
    TerminalDockGrowths.asks.set(sessionId, growth);
    return () => {
      if (TerminalDockGrowths.asks.get(sessionId) !== growth)
        return;
      TerminalDockGrowths.asks.delete(sessionId);
      growth.release?.();
    };
  }

  public static grow(sessionId: string, grow: (rows: number) => () => void): void {
    const growth: TerminalDockGrowth | undefined = TerminalDockGrowths.asks.get(sessionId);
    if (growth !== undefined && growth.release === null)
      growth.release = grow(growth.rows);
  }
}
