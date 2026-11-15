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

import { TerminalInputEdge } from "../../src/enums/terminal-input-edge.ts";
import { TerminalInputMark } from "../../src/models/terminal-input-mark.ts";
import { ProtocolReader } from "../../src/services/protocol.reader.ts";

describe("TerminalInputMark", () => {
  it("writes and reads its wire form", () => {
    const mark: TerminalInputMark = TerminalInputMark.fromReader(ProtocolReader.fromValue({ offset: 7, edge: "Start" }));

    assert.deepEqual([mark.offset, mark.edge], [7, TerminalInputEdge.Start]);
    assert.deepEqual(new TerminalInputMark(9, TerminalInputEdge.End).toJson(), { offset: 9, edge: "End" });
    assert.equal(TerminalInputMark.fromReader(ProtocolReader.fromValue({ offset: 3, edge: "RightPrompt" })).edge, TerminalInputEdge.RightPrompt);
    assert.equal(TerminalInputMark.fromReader(ProtocolReader.fromValue({ offset: 4, edge: "Continuation" })).edge, TerminalInputEdge.Continuation);
  });

  it("refuses a negative or fractional offset and an unknown edge", () => {
    assert.throws(() => new TerminalInputMark(-1, TerminalInputEdge.Start), ArgumentException);
    assert.throws(() => TerminalInputMark.fromReader(ProtocolReader.fromValue({ offset: 0.5, edge: "End" })), { name: "JsonException", path: "$.offset" });
    assert.throws(() => TerminalInputMark.fromReader(ProtocolReader.fromValue({ offset: 0, edge: "start" })), { name: "JsonException", path: "$.edge" });
  });
});
