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
import { TerminalLineRange } from "../../src/models/terminal-line-range.ts";
import { TerminalOutput } from "../../src/models/terminal-output.ts";

describe("TerminalOutput", () => {
  it("writes and reads its wire form", () => {
    const output: TerminalOutput = TerminalOutput.fromJson({ sessionId: "s1", offset: 10, data: "héllo", stored: { start: 3, end: 9, dropped: 3 },
      inputs: [] });

    assert.equal(output.offset, 10);
    assert.equal(output.data, "héllo");
    assert.deepEqual([output.stored.start, output.stored.end, output.stored.dropped], [3, 9, 3]);
    assert.deepEqual(
      new TerminalOutput("s1", 0, "x", new TerminalLineRange(0, 2)).toJson(),
      { sessionId: "s1", offset: 0, data: "x", stored: { start: 0, end: 2, dropped: 0 }, inputs: [] });
  });

  it("writes and reads the line's edges, at its start, inside and at its end", () => {
    const json: object = {
      sessionId: "s1", offset: 10, data: "$ ls\r\n", stored: { start: 0, end: 0, dropped: 0 },
      inputs: [{ offset: 10, edge: "End" }, { offset: 12, edge: "Start" }, { offset: 16, edge: "End" }]
    };
    const output: TerminalOutput = TerminalOutput.fromJson(json);

    assert.deepEqual(output.inputs.map(t => [t.offset, t.edge]), [[10, TerminalInputEdge.End], [12, TerminalInputEdge.Start], [16, TerminalInputEdge.End]]);
    assert.deepEqual(output.toJson(), json);
  });

  it("refuses an edge outside the batch or out of order", () => {
    const stored: TerminalLineRange = new TerminalLineRange(0, 0);
    for (const inputs of [[new TerminalInputMark(9, TerminalInputEdge.Start)], [new TerminalInputMark(14, TerminalInputEdge.Start)],
      [new TerminalInputMark(12, TerminalInputEdge.Start), new TerminalInputMark(11, TerminalInputEdge.End)]])
      assert.throws(() => new TerminalOutput("s1", 10, "abc", stored, inputs), { name: "ArgumentException", parameterName: "inputs" });
    assert.throws(() => TerminalOutput.fromJson({ sessionId: "s1", offset: 0, data: "", stored: { start: 0, end: 0, dropped: 0 } }),
      { name: "JsonException", path: "$.inputs" });
    assert.throws(() => TerminalOutput.fromJson({ sessionId: "s1", offset: 0, data: "", stored: { start: 0, end: 0, dropped: 0 },
      inputs: [{ offset: 0, edge: "Middle" }] }), { name: "JsonException", path: "$.inputs.0.edge" });
  });

  it("ends its offset after its data in UTF-16 code units", () => {
    assert.equal(new TerminalOutput("s1", 10, "a\u{1F600}", new TerminalLineRange(0, 0)).endOffset, 13);
  });

  it("refuses a fractional offset", () => {
    assert.throws(() => new TerminalOutput("s1", 0.5, "", new TerminalLineRange(0, 0)), ArgumentException);
    assert.throws(() => TerminalOutput.fromJson({ sessionId: "s1", offset: 0.5, data: "", stored: { start: 0, end: 0, dropped: 0 }, inputs: [] }), { name: "JsonException", path: "$.offset" });
  });

  it("refuses a blank session and data longer than one batch", () => {
    const stored: TerminalLineRange = new TerminalLineRange(0, 0);

    for (const sessionId of ["", " "])
      assert.throws(() => new TerminalOutput(sessionId, 0, "", stored), { name: "ArgumentException", parameterName: "sessionId" });
    assert.throws(() => new TerminalOutput("s1", 0, "d".repeat(1_048_577), stored), { name: "ArgumentException", parameterName: "data" });
  });

  it("keeps its own copy of the edges", () => {
    const inputs: TerminalInputMark[] = [new TerminalInputMark(0, TerminalInputEdge.Start)];
    const output: TerminalOutput = new TerminalOutput("s1", 0, "ls", new TerminalLineRange(0, 0), inputs);
    inputs.push(new TerminalInputMark(1, TerminalInputEdge.End));

    assert.equal(output.inputs.length, 1);
  });

  it("refuses an edge out of order at the edges' field when it reads them", () => {
    assert.throws(() => TerminalOutput.fromJson({ sessionId: "s1", offset: 10, data: "abc", stored: { start: 0, end: 0, dropped: 0 },
      inputs: [{ offset: 12, edge: "Start" }, { offset: 11, edge: "End" }] }), { name: "JsonException", path: "$.inputs" });
  });
});
