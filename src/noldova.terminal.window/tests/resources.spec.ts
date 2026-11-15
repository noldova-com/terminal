/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { Resources } from "../src/resources.ts";

describe("Resources", () => {
  it("says how the shell ended, with its exit code when it has one", () => {
    expect(Resources.formatExit(3)).toBe("The shell exited with code 3.");
    expect(Resources.formatExit(null)).toBe("The shell exited without an exit code.");
  });

  it("describes a failure by its message, or as text when it is not an error", () => {
    expect(Resources.formatOpenFailed(new Error("no shell"))).toBe("The terminal could not start: no shell");
    expect(Resources.formatCopyFailed("denied")).toBe("Copying the selection failed: denied");
    expect(Resources.formatLinkFailed(1)).toBe("Opening the link failed: 1");
    expect(Resources.formatFontFailed(new Error("bad"))).toBe("The terminal's font did not load, so it measures the font it has: bad");
  });

  it("lets a pane hold 50,000 stored lines, 100 pages of 500, before it leaves its live screen behind", () => {
    expect([Resources.storedLinesCap, Resources.storedPageLines, Resources.storedPages]).toEqual([50_000, 500, 100]);
  });

  it("names a font for the font loader", () => {
    expect(Resources.formatFont(13, "\"Noldova Mono\", monospace")).toBe("13px \"Noldova Mono\", monospace");
  });
});
