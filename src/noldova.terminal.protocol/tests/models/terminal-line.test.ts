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
import { TerminalTextRun } from "../../src/models/terminal-text-run.ts";

describe("TerminalLine", () => {
  it("writes and reads its wire form", () => {
    const json: object = {
      text: "ok done",
      wrapped: true,
      runs: [{ length: 2, foreground: 2, background: -1, style: 1 }, { length: 5, foreground: -1, background: -1, style: 0 }]
    };
    const line: TerminalLine = TerminalLine.fromJson(json);

    assert.deepEqual([line.text, line.isWrapped, line.runs.length], ["ok done", true, 2]);
    assert.deepEqual(line.toJson(), json);
  });

  it("keeps a blank line without runs", () => {
    const line: TerminalLine = new TerminalLine("", false, []);

    assert.deepEqual([line.runs.length, line.isWrapped], [0, false]);
  });

  it("keeps its own copy of its runs", () => {
    const runs: TerminalTextRun[] = [new TerminalTextRun(2, -1, -1, 0)];
    const line: TerminalLine = new TerminalLine("hi", false, runs);
    runs.push(new TerminalTextRun(1, -1, -1, 0));

    assert.equal(line.runs.length, 1);
  });

  it("refuses runs that don't cover its text exactly", () => {
    assert.throws(() => new TerminalLine("abc", false, [new TerminalTextRun(2, -1, -1, 0)]), { name: "ArgumentException", parameterName: "runs" });
    assert.throws(() => new TerminalLine("ab", false, [new TerminalTextRun(3, -1, -1, 0)]), { name: "ArgumentException", parameterName: "runs" });
    assert.throws(() => new TerminalLine("ab", false, []), { name: "ArgumentException", parameterName: "runs" });
  });

  it("names the nested field it cannot read", () => {
    assert.throws(
      () => TerminalLine.fromJson({ text: "ab", wrapped: false, runs: [{ length: "2", foreground: -1, background: -1, style: 0 }] }),
      { name: "JsonException", path: "$.runs.0.length" });
  });

  it("refuses text longer than a stored line holds", () => {
    assert.throws(() => new TerminalLine("t".repeat(1_048_577), false, []), { name: "ArgumentException", parameterName: "text" });
  });

  it("refuses runs that don't cover its text at the runs' field when it reads them", () => {
    assert.throws(() => TerminalLine.fromJson({ text: "abc", wrapped: false, runs: [] }), { name: "JsonException", path: "$.runs" });
  });
});
