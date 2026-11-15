/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalLine } from "../../src/models/terminal-line.ts";
import { TerminalRunOutput } from "../../src/models/terminal-run-output.ts";
import { TerminalTextRun } from "../../src/models/terminal-text-run.ts";

describe("TerminalRunOutput", () => {
  it("writes and reads its wire form", () => {
    const json: object = {
      lines: [
        { text: "$ ls", wrapped: false, runs: [{ length: 4, foreground: 2, background: -1, style: 1 }] },
        { text: "", wrapped: false, runs: [] }
      ],
      cutLines: 3
    };
    const output: TerminalRunOutput = TerminalRunOutput.fromJson(json);

    assert.deepEqual([output.lines.length, output.lines[0]?.text, output.lines[0]?.runs[0]?.foreground, output.cutLines], [2, "$ ls", 2, 3]);
    assert.deepEqual(output.toJson(), json);
  });

  it("can hold no lines, and up to 5000, and keeps its own copy of them", () => {
    const line: TerminalLine = new TerminalLine("a", false, [new TerminalTextRun(1, -1, -1, 0)]);
    const lines: TerminalLine[] = [line];
    const output: TerminalRunOutput = new TerminalRunOutput(lines, 0);
    lines.push(line);

    assert.equal(output.lines.length, 1);
    assert.equal(new TerminalRunOutput([], Number.MAX_SAFE_INTEGER).lines.length, 0);
    assert.equal(new TerminalRunOutput(new Array<TerminalLine>(5000).fill(line), 0).lines.length, 5000);
  });

  it("refuses more than 5000 lines, and cut lines that aren't a whole number of at least 0", () => {
    const line: TerminalLine = new TerminalLine("", false, []);

    assert.throws(() => new TerminalRunOutput(new Array<TerminalLine>(5001).fill(line), 0),
      { name: "ArgumentException", parameterName: "lines", message: "The value must hold at most 5000 lines. (Parameter 'lines')" });
    for (const cutLines of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1])
      assert.throws(() => new TerminalRunOutput([], cutLines), { name: "ArgumentOutOfRangeException", parameterName: "cutLines" });
  });

  it("refuses a missing or unknown field, and names the nested field it cannot read", () => {
    assert.throws(() => TerminalRunOutput.fromJson({ lines: [] }), { name: "JsonException", path: "$.cutLines" });
    assert.throws(() => TerminalRunOutput.fromJson({ lines: [], cutLines: -1 }), { name: "JsonException", path: "$.cutLines" });
    assert.throws(() => TerminalRunOutput.fromJson({ lines: [], cutLines: 0, start: 0 }), { name: "JsonException", path: "$.start" });
    assert.throws(() => TerminalRunOutput.fromJson({ lines: [{ text: 5, wrapped: false, runs: [] }], cutLines: 0 }), { name: "JsonException", path: "$.lines.0.text" });
  });

  it("counts the lines it reads before it reads any", () => {
    assert.throws(() => TerminalRunOutput.fromJson({ lines: new Array<object>(5001).fill({ text: 5 }), cutLines: 0 }),
      { name: "JsonException", path: "$.lines", message: "$.lines: Expected at most 5000 items." });
  });
});
