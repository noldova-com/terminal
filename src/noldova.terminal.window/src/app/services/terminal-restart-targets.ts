/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { ITerminalRestartTarget } from "../interfaces/i-terminal-restart-target.ts";
import type { TerminalTabKey } from "../models/terminal-tab-key.ts";

export class TerminalRestartTargets {
  private static readonly targets: Map<string, ITerminalRestartTarget> = new Map<string, ITerminalRestartTarget>();

  public static add(view: string, instance: string | null, target: ITerminalRestartTarget): () => void {
    const key: string = TerminalRestartTargets.keyOf(view, instance);
    TerminalRestartTargets.targets.set(key, target);
    return () => {
      if (TerminalRestartTargets.targets.get(key) === target)
        TerminalRestartTargets.targets.delete(key);
    };
  }

  public static has(view: string, instance: string | null): boolean {
    return TerminalRestartTargets.targets.has(TerminalRestartTargets.keyOf(view, instance));
  }

  public static find(tab: TerminalTabKey | null): ITerminalRestartTarget | undefined {
    return Object.isNull(tab) ? undefined : TerminalRestartTargets.targets.get(TerminalRestartTargets.keyOf(tab.view, tab.instance));
  }

  private static keyOf(view: string, instance: string | null): string {
    return JSON.stringify([view, instance]);
  }
}
