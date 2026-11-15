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

import { TerminalInputStart } from "../../src/models/terminal-input-start.ts";
import { ProtocolReader } from "../../src/services/protocol.reader.ts";

describe("TerminalInputStart", () => {
  it("writes and reads its wire form", () => {
    const start: TerminalInputStart = TerminalInputStart.fromReader(ProtocolReader.fromValue({ rowsAbove: 2, column: 1_000, rightPrompt: null }));

    assert.deepEqual([start.rowsAbove, start.column, start.rightPrompt], [2, 1_000, null]);
    assert.deepEqual(new TerminalInputStart(0, 5).toJson(), { rowsAbove: 0, column: 5, rightPrompt: null });
  });

  it("writes and reads a right prompt's column, which is null without one", () => {
    const start: TerminalInputStart = TerminalInputStart.fromReader(ProtocolReader.fromValue({ rowsAbove: 0, column: 2, rightPrompt: 30 }));

    assert.deepEqual([start.rightPrompt, new TerminalInputStart(0, 2).rightPrompt], [30, null]);
    assert.deepEqual(new TerminalInputStart(1, 2, 30).toJson(), { rowsAbove: 1, column: 2, rightPrompt: 30 });
  });

  it("refuses a start whose right prompt's field is missing, since null stands for none", () => {
    assert.throws(() => TerminalInputStart.fromReader(ProtocolReader.fromValue({ rowsAbove: 0, column: 2 })), { name: "JsonException", path: "$.rightPrompt" });
  });

  it("refuses rows or a column out of range", () => {
    assert.throws(() => new TerminalInputStart(-1, 0), ArgumentException);
    assert.throws(() => new TerminalInputStart(0, 1_001), ArgumentException);
    assert.throws(() => new TerminalInputStart(0, 0, 1_001), ArgumentException);
    assert.throws(() => TerminalInputStart.fromReader(ProtocolReader.fromValue({ rowsAbove: 0, column: 0, rightPrompt: -1 })), { name: "JsonException", path: "$.rightPrompt" });
    assert.throws(() => TerminalInputStart.fromReader(ProtocolReader.fromValue({ rowsAbove: 0, column: 0, rightPrompt: null, row: 1 })), { name: "JsonException", path: "$.row" });
  });
});
