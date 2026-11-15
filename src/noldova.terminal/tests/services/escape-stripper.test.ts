/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { EscapeStripper } from "../../src/services/escape-stripper.ts";

function strip(...chunks: readonly string[]): string {
  const stripper: EscapeStripper = new EscapeStripper();
  return chunks.map(t => stripper.strip(t)).join("");
}

describe("EscapeStripper", () => {
  it("keeps text, tabs and line feeds, and drops other controls", () => {
    assert.equal(strip("a\tb\u0007c\u0008d\u007fe\nf ü 😀"), "a\tbcde\nf ü 😀");
  });

  it("turns a carriage return into one line end", () => {
    assert.equal(strip("one\r\ntwo\rthree\r", "\nfour\r", "\r", "five"), "one\ntwo\nthree\nfour\nfive");
  });

  it("drops a run of controls at once, and turns a carriage return in it into one line end", () => {
    assert.equal(strip("a\u0000\u0007\r\u0001b\u0007\u0008c", "\r".repeat(1_048_576), "d"), "a\nbc\nd");
  });

  it("drops control sequences, even split across chunks", () => {
    assert.equal(strip("\u001b[1;3", "1mred\u001b[0m \u001b[?25h", "x"), "red x");
    assert.equal(strip("a\u001b[1\u001b[2Kb"), "ab");
  });

  it("drops strings ended by a bell or a string terminator", () => {
    assert.equal(strip("\u001b]0;title\u0007a\u001b]6973;C;n1\u001b", "\\b"), "ab");
    assert.equal(strip("\u001bPdata\u001bxmore\u001b\\c\u001bX\u0007\u001b^\u0007\u001b_\u0007d"), "cd");
  });

  it("drops escapes with intermediates and single-character escapes", () => {
    assert.equal(strip("\u001b(Ba\u001b#", "8b\u001b=c\u001b7d\u001b$(Be"), "abcde");
  });
});
