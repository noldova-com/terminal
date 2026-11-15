/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalLineRange } from "../../src/models/terminal-line-range.ts";
import { ProtocolReader } from "../../src/services/protocol.reader.ts";

describe("TerminalLineRange", () => {
  it("writes and reads its wire form", () => {
    const json: object = { start: 40, end: 1200, dropped: 25 };
    const range: TerminalLineRange = TerminalLineRange.fromReader(ProtocolReader.fromValue(json));

    assert.deepEqual([range.start, range.end, range.dropped], [40, 1200, 25]);
    assert.deepEqual(range.toJson(), json);
  });

  it("can be empty, with nothing dropped unless it says so", () => {
    const range: TerminalLineRange = new TerminalLineRange(7, 7);

    assert.deepEqual([range.start, range.end, range.dropped], [7, 7, 0]);
  });

  it("can have dropped every line before its start", () => {
    assert.equal(new TerminalLineRange(7, 9, 7).dropped, 7);
  });

  it("refuses a negative or fractional line, an end before its start, and more dropped than come before it", () => {
    assert.throws(() => new TerminalLineRange(-1, 3), { name: "ArgumentOutOfRangeException", parameterName: "start" });
    assert.throws(() => new TerminalLineRange(1.5, 3), { name: "ArgumentOutOfRangeException", parameterName: "start" });
    assert.throws(() => new TerminalLineRange(1, 2.5), { name: "ArgumentOutOfRangeException", parameterName: "end" });
    assert.throws(() => new TerminalLineRange(5, 4), { name: "ArgumentException", parameterName: "end" });
    for (const dropped of [-1, 0.5])
      assert.throws(() => new TerminalLineRange(5, 6, dropped), { name: "ArgumentOutOfRangeException", parameterName: "dropped" });
    assert.throws(() => new TerminalLineRange(5, 6, 6), { name: "ArgumentException", parameterName: "dropped" });
  });

  it("names the field it cannot read", () => {
    assert.throws(() => TerminalLineRange.fromReader(ProtocolReader.fromValue({ start: 0, end: null, dropped: 0 })), { name: "JsonException", path: "$.end" });
    assert.throws(() => TerminalLineRange.fromReader(ProtocolReader.fromValue({ start: 0, end: 0 })), { name: "JsonException", path: "$.dropped" });
  });

  it("refuses an end before its start, and more dropped than come before it, at their fields when it reads them", () => {
    assert.throws(() => TerminalLineRange.fromReader(ProtocolReader.fromValue({ start: 5, end: 4, dropped: 0 }, "$.stored")),
      { name: "JsonException", path: "$.stored.end" });
    assert.throws(() => TerminalLineRange.fromReader(ProtocolReader.fromValue({ start: 5, end: 6, dropped: 6 })), { name: "JsonException", path: "$.dropped" });
  });
});
