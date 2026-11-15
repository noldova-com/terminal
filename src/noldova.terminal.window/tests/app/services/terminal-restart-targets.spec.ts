/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import type { ITerminalRestartTarget } from "../../../src/app/interfaces/i-terminal-restart-target.ts";
import { TerminalTabKey } from "../../../src/app/models/terminal-tab-key.ts";
import { TerminalRestartTargets } from "../../../src/app/services/terminal-restart-targets.ts";

class FakeTarget implements ITerminalRestartTarget {
  public canRestart(): boolean {
    return true;
  }

  public async restartAsync(): Promise<void> {
  }
}

function find(tab: string): ITerminalRestartTarget | undefined {
  return TerminalRestartTargets.find(TerminalTabKey.fromArguments({ tab }));
}

describe("TerminalRestartTargets", () => {
  it("finds the target of the tab the menu opened on by its view and instance, and none for another", () => {
    const tab: FakeTarget = new FakeTarget();
    const panel: FakeTarget = new FakeTarget();
    const removals: (() => void)[] = [TerminalRestartTargets.add("terminal.session", "s1", tab), TerminalRestartTargets.add("terminal.panel", null, panel)];

    try {
      expect([find("view/terminal.session/s1"), find("view/terminal.panel"), find("view/terminal.session/s2"), find("view/terminal.session")])
        .toEqual([tab, panel, undefined, undefined]);
      expect(TerminalRestartTargets.find(null)).toBeUndefined();
      expect([TerminalRestartTargets.has("terminal.session", "s1"), TerminalRestartTargets.has("terminal.panel", null), TerminalRestartTargets.has("terminal.session", "s2")])
        .toEqual([true, true, false]);
    }
    finally {
      for (const remove of removals)
        remove();
    }
    expect([find("view/terminal.session/s1"), find("view/terminal.panel")]).toEqual([undefined, undefined]);
  });

  it("keeps a target that took another's place when the first is removed", () => {
    const first: FakeTarget = new FakeTarget();
    const second: FakeTarget = new FakeTarget();
    const removeFirst: () => void = TerminalRestartTargets.add("terminal.session", "s1", first);
    const removeSecond: () => void = TerminalRestartTargets.add("terminal.session", "s1", second);

    removeFirst();

    expect(find("view/terminal.session/s1")).toBe(second);
    removeSecond();
    expect(find("view/terminal.session/s1")).toBeUndefined();
  });
});
