/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ShellLine } from "../../src/models/shell-line.ts";

describe("ShellLine", () => {
  it("holds its words, the last word's start, value and quote, and whether it starts quoted", () => {
    const line: ShellLine = new ShellLine(["cd", "My Fi"], 3, "My Fi", "\"", true);

    assert.deepEqual(line.words, ["cd", "My Fi"]);
    assert.equal(line.start, 3);
    assert.equal(line.value, "My Fi");
    assert.equal(line.quote, "\"");
    assert.equal(line.startsQuoted, true);
  });

  it("holds no quote for an unquoted word", () => {
    const line: ShellLine = new ShellLine(["ls", "sr"], 3, "sr", null, false);

    assert.equal(line.quote, null);
    assert.equal(line.startsQuoted, false);
  });
});
