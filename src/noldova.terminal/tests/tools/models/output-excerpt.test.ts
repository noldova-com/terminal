/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ArgumentException } from "@noldova/context.exceptions";
import { describe, it } from "vitest";

import { OutputExcerpt } from "../../../src/tools/models/output-excerpt.ts";

function marker(count: number): string {
  return `\n[… characters left out: ${count}; the log file keeps the output up to 16777216 characters, and says where it stops …]\n`;
}

describe("OutputExcerpt", () => {
  it("keeps output within the limit whole", () => {
    const excerpt: OutputExcerpt = new OutputExcerpt("abcdef", 6);

    assert.equal(excerpt.text, "abcdef");
    assert.equal(excerpt.omittedCharacters, 0);
  });

  it("keeps the head and the tail of longer output and says how much it left out", () => {
    const excerpt: OutputExcerpt = new OutputExcerpt("abcdefghij", 6);

    assert.equal(excerpt.text, `abc${marker(4)}hij`);
    assert.equal(excerpt.omittedCharacters, 4);
  });

  it("gives the odd character to the head", () => {
    assert.equal(new OutputExcerpt("abcdefghi", 5).text, `abc${marker(4)}hi`);
  });

  it("keeps only the head at a limit of one", () => {
    assert.equal(new OutputExcerpt("ab", 1).text, `a${marker(1)}`);
  });

  it("never splits a surrogate pair at either cut", () => {
    const excerpt: OutputExcerpt = new OutputExcerpt("ab😀cdef😀hi", 6);

    assert.equal(excerpt.text, `ab${marker(8)}hi`);
    assert.equal(excerpt.omittedCharacters, 8);
  });

  it("refuses a limit out of range", () => {
    assert.throws(() => new OutputExcerpt("a", 0), ArgumentException);
    assert.throws(() => new OutputExcerpt("a", 30_001), ArgumentException);
  });
});
