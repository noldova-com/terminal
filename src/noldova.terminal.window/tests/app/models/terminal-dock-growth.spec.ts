/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { TerminalDockGrowth } from "../../../src/app/models/terminal-dock-growth.ts";

describe("TerminalDockGrowth", () => {
  it("holds its rows and no release until the dock grows", () => {
    const growth: TerminalDockGrowth = new TerminalDockGrowth(12);

    expect([growth.rows, growth.release]).toEqual([12, null]);
  });
});
