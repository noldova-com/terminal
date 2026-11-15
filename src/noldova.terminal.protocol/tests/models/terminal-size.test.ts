/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { describe, it } from "vitest";

import { TerminalSize } from "../../src/models/terminal-size.ts";

describe("TerminalSize", () => {
  it("writes and reads its wire form", () => {
    const size: TerminalSize = TerminalSize.fromJson({ cols: 120, rows: 30 });

    assert.equal(size.columns, 120);
    assert.equal(size.rows, 30);
    assert.deepEqual(new TerminalSize(1, 1000).toJson(), { cols: 1, rows: 1000 });
  });

  it("compares columns and rows", () => {
    const size: TerminalSize = new TerminalSize(80, 24);

    assert.equal(size.equals(new TerminalSize(80, 24)), true);
    assert.equal(size.equals(new TerminalSize(81, 24)), false);
    assert.equal(size.equals(new TerminalSize(80, 25)), false);
  });

  it("refuses a size outside 1 to 1000", () => {
    assert.throws(() => new TerminalSize(0, 24), ArgumentException);
    assert.throws(() => new TerminalSize(80, 1001), ArgumentException);
  });

  it("names the field it cannot read", () => {
    assert.throws(() => TerminalSize.fromJson({ cols: 80, rows: 0 }), { name: "JsonException", path: "$.rows" });
    assert.throws(() => TerminalSize.fromJson({ cols: 80, rows: 24, width: 1 }), JsonException);
  });
});
