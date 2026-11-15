/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { EscapeSequenceTracker } from "../../src/services/escape-sequence-tracker.ts";

function track(...chunks: string[]): string {
  const tracker: EscapeSequenceTracker = new EscapeSequenceTracker();
  for (const chunk of chunks)
    tracker.track(chunk);
  return tracker.pending;
}

describe("EscapeSequenceTracker", () => {
  const cases: readonly (readonly [string, readonly string[], string])[] = [
    ["plain text", ["hello\r\n"], ""],
    ["an unfinished control sequence", ["a\u001b[3"], "\u001b[3"],
    ["a control sequence finished in the next chunk", ["a\u001b[3", "1m"], ""],
    ["a control sequence carried over two chunks", ["\u001b[3", "8;5"], "\u001b[38;5"],
    ["a control sequence with intermediates and a delete", ["\u001b[ \u007f"], "\u001b[ \u007f"],
    ["a control sequence ended by a character above the final range", ["\u001b[1é"], ""],
    ["an unfinished title", ["\u001b]0;ti"], "\u001b]0;ti"],
    ["a title ended by a bell", ["\u001b]0;ti", "tle\u0007"], ""],
    ["a title ended by an 8-bit string terminator", ["\u001b]0;title\u009c"], ""],
    ["a title whose string terminator is split", ["\u001b]0;title\u001b"], "\u001b"],
    ["a title whose split string terminator ends", ["\u001b]0;title\u001b", "\\"], ""],
    ["a device control string", ["\u001bPq#0"], "\u001bPq#0"],
    ["a device control string that a bell does not end", ["\u001bPq\u0007"], "\u001bPq\u0007"],
    ["a device control string ended by an 8-bit string terminator", ["\u001bPq\u009c"], ""],
    ["a start of string", ["\u001bXs"], "\u001bXs"],
    ["a privacy message", ["\u001b^p"], "\u001b^p"],
    ["an application program command", ["\u001b_a"], "\u001b_a"],
    ["an 8-bit control sequence introducer", ["\u009b3"], "\u009b3"],
    ["an 8-bit operating system command", ["\u009d0;t"], "\u009d0;t"],
    ["an 8-bit device control string", ["\u0090q"], "\u0090q"],
    ["an 8-bit start of string", ["\u0098s"], "\u0098s"],
    ["an 8-bit privacy message", ["\u009ep"], "\u009ep"],
    ["an 8-bit application program command", ["\u009fa"], "\u009fa"],
    ["a sequence cancelled", ["\u001b[3\u0018"], ""],
    ["a sequence substituted", ["\u001b]0;t\u001a"], ""],
    ["an escape with an intermediate", ["\u001b("], "\u001b("],
    ["an escape with an intermediate, a control and a delete", ["\u001b(\n\u007f"], "\u001b(\n\u007f"],
    ["an escape with an intermediate finished", ["\u001b(", "B"], ""],
    ["an escape with a control inside", ["\u001b\n"], "\u001b\n"],
    ["an escape with a delete inside", ["\u001b\u007f"], "\u001b\u007f"],
    ["a finished escape", ["\u001b7"], ""],
    ["an escape ended by a character above the final range", ["\u001bé"], ""],
    ["an escape that restarts", ["\u001b[1", "\u001b[2"], "\u001b[2"],
    ["an escape inside an escape", ["\u001b\u001b["], "\u001b["],
    ["a sequence after a finished one in the same chunk", ["\u001b[1", "m\u001b]x"], "\u001b]x"],
    ["a sequence after text, controls and a stray string terminator", ["a\r\n\u0018\u001a\u009cb\u001b[3"], "\u001b[3"],
    ["a sequence after a mebibyte of text", [`${"x".repeat(1_048_576)}\u001b]t`], "\u001b]t"],
    ["a sequence after a mebibyte inside a title", [`\u001b]0;${"t".repeat(1_048_576)}\u0007\u001b[3`], "\u001b[3"],
    ["a sequence after a mebibyte and a bell inside a device control string", [`\u001bPq${"#".repeat(1_048_576)}\u0007\u009c\u001b[3`], "\u001b[3"]
  ];

  for (const [name, chunks, pending] of cases)
    it(`keeps the pending tail of ${name}`, () => {
      assert.equal(track(...chunks), pending);
    });

  it("gives up a tail longer than 1 MiB until the next sequence", () => {
    const tracker: EscapeSequenceTracker = new EscapeSequenceTracker();

    tracker.track(`\u001b]${"a".repeat(1_048_574)}`);
    assert.equal(tracker.pending.length, 1_048_576);
    tracker.track("a");
    assert.equal(tracker.pending, "");
    tracker.track("b");
    assert.equal(tracker.pending, "");
    tracker.track("\u0007\u001b[");

    assert.equal(tracker.pending, "\u001b[");
  });
});
