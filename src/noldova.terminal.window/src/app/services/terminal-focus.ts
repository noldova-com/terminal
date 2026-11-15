/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ITerminalFocusTarget } from "../interfaces/i-terminal-focus-target.ts";

export class TerminalFocus {
  private static readonly targets: Set<ITerminalFocusTarget> = new Set<ITerminalFocusTarget>();
  private static lastUsed: ITerminalFocusTarget | null = null;
  private static returnTo: HTMLElement | null = null;
  private static readonly unasked: Set<string> = new Set<string>();

  public static add(target: ITerminalFocusTarget): () => void {
    TerminalFocus.targets.add(target);
    return () => {
      TerminalFocus.targets.delete(target);
      if (TerminalFocus.lastUsed === target)
        TerminalFocus.lastUsed = null;
    };
  }

  public static openUnasked(sessionId: string): void {
    TerminalFocus.unasked.add(sessionId);
  }

  public static takeUnasked(sessionId: string): boolean {
    return TerminalFocus.unasked.delete(sessionId);
  }

  public static enter(target: ITerminalFocusTarget, from: EventTarget | null): void {
    TerminalFocus.lastUsed = target;
    if (!(from instanceof Element && TerminalFocus.isInTerminal(from)))
      TerminalFocus.returnTo = from instanceof HTMLElement ? from : null;
  }

  public static async toggleAsync(): Promise<boolean> {
    const targets: readonly ITerminalFocusTarget[] = [...TerminalFocus.targets];
    const active: Element | null = document.activeElement;
    const focused: ITerminalFocusTarget | undefined = targets.find(t => t.contains(active));
    if (focused !== undefined) {
      const returnTo: HTMLElement | null = TerminalFocus.returnTo;
      TerminalFocus.returnTo = null;
      returnTo?.focus();
      if (document.activeElement === active && active instanceof HTMLElement)
        active.blur();
      focused.hideDock();
      return true;
    }
    const last: ITerminalFocusTarget | null = TerminalFocus.lastUsed;
    for (const target of [...(last === null ? [] : [last]), ...targets.filter(t => t !== last).reverse()])
      if (await target.showAsync())
        return true;
    return false;
  }

  public static async showAsync(sessionId: string): Promise<boolean> {
    return await [...TerminalFocus.targets].find(t => t.isFor(sessionId))?.showAsync() ?? false;
  }

  private static isInTerminal(element: Element | null): boolean {
    return [...TerminalFocus.targets].some(t => t.contains(element));
  }
}
