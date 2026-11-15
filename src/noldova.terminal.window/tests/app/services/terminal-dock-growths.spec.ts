/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { TerminalDockGrowths } from "../../../src/app/services/terminal-dock-growths.ts";

describe("TerminalDockGrowths", () => {
  it("grows a terminal's dock once for its ask's rows, and releases that growth with the ask", () => {
    const events: string[] = [];
    const release: () => void = TerminalDockGrowths.ask("s1", 16);

    for (let index: number = 0; index < 2; index++)
      TerminalDockGrowths.grow("s1", rows => {
        events.push(`grown ${rows}`);
        return () => events.push("released");
      });
    release();
    release();
    TerminalDockGrowths.grow("s1", () => () => events.push("grown again"));

    expect(events).toEqual(["grown 16", "released"]);
  });

  it("grows nothing for a terminal without an ask, and releases an ask its dock never grew for", () => {
    const events: string[] = [];
    TerminalDockGrowths.grow("s2", () => () => events.push("grown"));
    const release: () => void = TerminalDockGrowths.ask("s2", 16);

    release();
    TerminalDockGrowths.grow("s2", () => () => events.push("grown"));

    expect(events).toEqual([]);
  });

  it("keeps a later ask for the same terminal when the earlier one is released", () => {
    const events: string[] = [];
    const earlier: () => void = TerminalDockGrowths.ask("s3", 16);
    const later: () => void = TerminalDockGrowths.ask("s3", 30);

    earlier();
    TerminalDockGrowths.grow("s3", rows => {
      events.push(`grown ${rows}`);
      return () => events.push("released");
    });
    later();

    expect(events).toEqual(["grown 30", "released"]);
  });
});
