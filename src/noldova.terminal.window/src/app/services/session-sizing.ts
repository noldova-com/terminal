/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalSize } from "@noldova/terminal.protocol";

import type { ISizedPane } from "../interfaces/i-sized-pane.ts";

export class SessionSizing {
  private static readonly panes: Map<string, ISizedPane[]> = new Map<string, ISizedPane[]>();
  private static readonly sizers: Map<string, ISizedPane> = new Map<string, ISizedPane>();
  private static readonly claimed: WeakSet<ISizedPane> = new WeakSet<ISizedPane>();

  public static join(sessionId: string, pane: ISizedPane): () => void {
    const panes: ISizedPane[] = (SessionSizing.panes.get(sessionId) ?? []).filter(t => t !== pane);
    const claimer: number = panes.findIndex(t => SessionSizing.claimed.has(t) || t.hasFocus());
    panes.splice(claimer === -1 ? panes.length : claimer, 0, pane);
    SessionSizing.panes.set(sessionId, panes);
    SessionSizing.choose(sessionId);
    return () => {
      SessionSizing.claimed.delete(pane);
      const panes: ISizedPane[] = (SessionSizing.panes.get(sessionId) ?? []).filter(t => t !== pane);
      if (panes.length === 0)
        SessionSizing.panes.delete(sessionId);
      else
        SessionSizing.panes.set(sessionId, panes);
      SessionSizing.choose(sessionId);
    };
  }

  public static claim(sessionId: string, pane: ISizedPane): void {
    const panes: readonly ISizedPane[] | undefined = SessionSizing.panes.get(sessionId);
    if (panes?.includes(pane) === true) {
      SessionSizing.claimed.add(pane);
      SessionSizing.panes.set(sessionId, [...panes.filter(t => t !== pane), pane]);
      SessionSizing.choose(sessionId);
    }
  }

  public static update(sessionId: string): void {
    SessionSizing.choose(sessionId);
  }

  public static isSizing(sessionId: string, pane: ISizedPane): boolean {
    return SessionSizing.sizers.get(sessionId) === pane;
  }

  public static resized(sessionId: string, pane: ISizedPane, size: TerminalSize): void {
    const panes: readonly ISizedPane[] | undefined = SessionSizing.isSizing(sessionId, pane) ? SessionSizing.panes.get(sessionId) : undefined;
    for (const other of panes ?? [])
      if (other !== pane)
        other.follow(size);
  }

  private static choose(sessionId: string): void {
    const panes: readonly ISizedPane[] = SessionSizing.panes.get(sessionId) ?? [];
    const next: ISizedPane | undefined = panes.findLast(t => t.isShown()) ?? panes.at(-1);
    if (next === SessionSizing.sizers.get(sessionId))
      return;
    if (next === undefined)
      SessionSizing.sizers.delete(sessionId);
    else {
      SessionSizing.sizers.set(sessionId, next);
      next.lead();
    }
  }
}
