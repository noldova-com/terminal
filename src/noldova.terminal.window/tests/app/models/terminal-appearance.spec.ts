/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ITheme } from "@xterm/xterm";
import { describe, expect, it } from "vitest";

import { TerminalAppearance } from "../../../src/app/models/terminal-appearance.ts";

describe("TerminalAppearance", () => {
  it("holds its theme, font family, font size and scrollbar size", () => {
    const theme: ITheme = { background: "#101010", foreground: "#f0f0f0" };
    const appearance: TerminalAppearance = new TerminalAppearance(theme, "monospace", 13, 10);

    expect(appearance.theme).toBe(theme);
    expect([appearance.fontFamily, appearance.fontSize, appearance.scrollbarSize]).toEqual(["monospace", 13, 10]);
  });
});
