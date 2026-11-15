/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { LinkPolicy } from "../../../src/app/services/link-policy.ts";

describe("LinkPolicy", () => {
  it("allows only web and mail links", () => {
    expect(["https://noldova.com/a", "http://localhost:8080", "mailto:team@example.com"].map(t => LinkPolicy.isAllowed(t))).toEqual([true, true, true]);
    expect(["file:///etc/passwd", "javascript:alert(1)", "editor://open", "not a url"].map(t => LinkPolicy.isAllowed(t))).toEqual([false, false, false, false]);
  });

  it("opens on Cmd+click on macOS and Ctrl+click elsewhere, with the left button only", () => {
    expect(LinkPolicy.isOpening(new MouseEvent("click", { metaKey: true }), true)).toBe(true);
    expect(LinkPolicy.isOpening(new MouseEvent("click", { ctrlKey: true }), true)).toBe(false);
    expect(LinkPolicy.isOpening(new MouseEvent("click", { ctrlKey: true }), false)).toBe(true);
    expect(LinkPolicy.isOpening(new MouseEvent("click"), false)).toBe(false);
    expect(LinkPolicy.isOpening(new MouseEvent("mouseup", { button: 1, ctrlKey: true }), false)).toBe(false);
    expect(LinkPolicy.isOpening(new MouseEvent("mouseup", { button: 2, ctrlKey: true }), false)).toBe(false);
    expect(LinkPolicy.isOpening(new MouseEvent("mouseup", { button: 1, metaKey: true }), true)).toBe(false);
  });
});
