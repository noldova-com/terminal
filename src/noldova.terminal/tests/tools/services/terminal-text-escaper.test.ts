/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalTextEscaper } from "../../../src/tools/services/terminal-text-escaper.ts";

describe("TerminalTextEscaper", () => {
  it("finds C0, DEL and C1 controls", () => {
    for (const text of ["\u0000", "\u001f", "\u007f", "\u0080", "\u009f", "a\rb"])
      assert.equal(TerminalTextEscaper.hasControls(text), true, JSON.stringify(text));
    for (const text of ["", "plain", " ", "é", "😀"])
      assert.equal(TerminalTextEscaper.hasControls(text), false, JSON.stringify(text));
  });

  it("finds bidirectional and zero-width characters", () => {
    for (const text of ["\u061C", "\u200B", "\u200F", "\u202A", "\u202E", "\u2060", "\u2064", "\u2066", "\u2069", "\uFEFF"])
      assert.equal(TerminalTextEscaper.hasHiddenCharacters(text), true, JSON.stringify(text));
    for (const text of ["⁥", "⁰", "abc", "\u2027", "\u{E0080}"])
      assert.equal(TerminalTextEscaper.hasHiddenCharacters(text), false, JSON.stringify(text));
  });

  it("finds the soft hyphen, the Mongolian vowel separator, the line and paragraph separators and the tag characters", () => {
    for (const text of ["\u00AD", "\u180E", "\u2028", "\u2029", "\u{E0001}", "\u{E0041}", "\u{E007F}"])
      assert.equal(TerminalTextEscaper.hasHiddenCharacters(text), true, JSON.stringify(text));
  });

  it("escapes a character beyond the Basic Multilingual Plane whole, by its code point", () => {
    assert.equal(TerminalTextEscaper.escape("a\u{E0041}b\u2028"), "a\\u{E0041}b\\u{2028}");
    assert.equal(TerminalTextEscaper.escapeHidden("a\\b\u{E0041}\u00AD"), "a\\b\\u{E0041}\\u{00AD}");
  });

  it("escapes controls and hidden characters in text shown as it is, and keeps its backslashes", () => {
    assert.equal(TerminalTextEscaper.escapeUnseen("C:\\a\u0007\u202Eb\u{E0041}"), "C:\\a\\u{0007}\\u{202E}b\\u{E0041}");
    assert.equal(TerminalTextEscaper.escapeUnseen("bash - project 😀"), "bash - project 😀");
  });

  it("escapes backslashes, common controls by name and others by code point", () => {
    assert.equal(TerminalTextEscaper.escape("a\\b\r\n\t"), "a\\\\b\\r\\n\\t");
    assert.equal(TerminalTextEscaper.escape("\u0003\u001b\u007f\u0085"), "\\u{0003}\\u{001B}\\u{007F}\\u{0085}");
    assert.equal(TerminalTextEscaper.escape("x\u202Ey\uFEFF"), "x\\u{202E}y\\u{FEFF}");
  });

  it("leaves other text, emoji included, as it is", () => {
    assert.equal(TerminalTextEscaper.escape("ls -la ~/é 😀"), "ls -la ~/é 😀");
  });
});
