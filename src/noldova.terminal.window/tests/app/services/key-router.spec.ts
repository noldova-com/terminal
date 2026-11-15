/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { KeyRouter } from "../../../src/app/services/key-router.ts";

function key(text: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: text, ...init });
}

describe("KeyRouter", () => {
  const mac: KeyRouter = new KeyRouter(true, false);
  const windows: KeyRouter = new KeyRouter(false, true);
  const linux: KeyRouter = new KeyRouter(false, false);

  it("keeps Cmd keys for the window on macOS and gives the shell Ctrl keys", () => {
    expect(mac.isForShell(key("k", { metaKey: true }), false, null)).toBe(false);
    expect(mac.isForShell(key("c", { ctrlKey: true }), true, null)).toBe(true);
  });

  it("keeps Ctrl+Shift keys for the window elsewhere and gives the shell plain Ctrl keys", () => {
    expect(linux.isForShell(key("V", { ctrlKey: true, shiftKey: true }), false, null)).toBe(false);
    expect(linux.isForShell(key("c", { ctrlKey: true }), true, null)).toBe(true);
    expect(windows.isForShell(key("c", { ctrlKey: true }), false, null)).toBe(true);
  });

  it("gives the window a key it runs one of the module's commands for, whatever key the person bound, on every system", () => {
    for (const router of [mac, windows, linux])
      expect(router.isForShell(key("j", { ctrlKey: true }), false, "terminal.toggle")).toBe(false);
    expect(linux.isForShell(key("k", { ctrlKey: true }), false, "chats.find")).toBe(true);
    expect(mac.isForShell(key("k", { ctrlKey: true }), false, "chats.find")).toBe(true);
  });

  it("keeps Ctrl+C for copying on Windows only while text is selected", () => {
    expect(windows.isForShell(key("c", { ctrlKey: true }), true, null)).toBe(false);
    expect(windows.isForShell(key("c", { ctrlKey: true, altKey: true }), true, null)).toBe(true);
    expect(windows.isForShell(key("x", { ctrlKey: true }), true, null)).toBe(true);
  });

  it("copies with Cmd+C on macOS", () => {
    expect(mac.isCopy(key("c", { metaKey: true }), false)).toBe(true);
    expect(mac.isCopy(key("c", { metaKey: true, shiftKey: true }), true)).toBe(false);
    expect(mac.isCopy(key("c", { metaKey: true, ctrlKey: true }), true)).toBe(false);
    expect(mac.isCopy(key("c", { ctrlKey: true }), true)).toBe(false);
  });

  it("copies with Ctrl+Shift+C elsewhere, and with Ctrl+C on Windows while text is selected", () => {
    expect(linux.isCopy(key("C", { ctrlKey: true, shiftKey: true }), false)).toBe(true);
    expect(linux.isCopy(key("c", { ctrlKey: true }), true)).toBe(false);
    expect(windows.isCopy(key("c", { ctrlKey: true }), true)).toBe(true);
    expect(windows.isCopy(key("c", { ctrlKey: true }), false)).toBe(false);
    expect(windows.isCopy(key("c"), true)).toBe(false);
  });

  it("does not copy with Alt or another key", () => {
    expect(linux.isCopy(key("c", { ctrlKey: true, shiftKey: true, altKey: true }), true)).toBe(false);
    expect(linux.isCopy(key("v", { ctrlKey: true, shiftKey: true }), true)).toBe(false);
  });
});
