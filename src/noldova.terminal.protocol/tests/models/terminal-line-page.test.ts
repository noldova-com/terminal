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
import { TerminalLinePage } from "../../src/models/terminal-line-page.ts";
import { TerminalLineRange } from "../../src/models/terminal-line-range.ts";
import { TerminalTextRun } from "../../src/models/terminal-text-run.ts";

describe("TerminalLinePage", () => {
  it("writes and reads its wire form", () => {
    const json: object = {
      start: 10,
      lines: [
        { text: "one", wrapped: false, runs: [{ length: 3, foreground: -1, background: -1, style: 0 }] },
        { text: "", wrapped: false, runs: [] }
      ],
      stored: { start: 10, end: 12, dropped: 4 }
    };
    const page: TerminalLinePage = TerminalLinePage.fromJson(json);

    assert.deepEqual([page.start, page.lines[0]?.text, page.stored.end], [10, "one", 12]);
    assert.deepEqual(page.toJson(), json);
  });

  it("can be an empty page at the end of the stored lines", () => {
    assert.equal(new TerminalLinePage(12, [], new TerminalLineRange(10, 12)).lines.length, 0);
  });

  it("keeps its own copy of its lines", () => {
    const lines: TerminalLine[] = [new TerminalLine("a", false, [new TerminalTextRun(1, -1, -1, 0)])];
    const page: TerminalLinePage = new TerminalLinePage(0, lines, new TerminalLineRange(0, 2));
    lines.push(new TerminalLine("", false, []));

    assert.equal(page.lines.length, 1);
  });

  it("refuses lines outside the stored lines", () => {
    const line: TerminalLine = new TerminalLine("", false, []);
    const stored: TerminalLineRange = new TerminalLineRange(10, 12);

    assert.throws(() => new TerminalLinePage(9, [], stored), { name: "ArgumentException", parameterName: "lines" });
    assert.throws(() => new TerminalLinePage(11, [line, line], stored), { name: "ArgumentException", parameterName: "lines" });
    assert.throws(() => new TerminalLinePage(13, [], stored), { name: "ArgumentException", parameterName: "lines" });
    assert.throws(() => new TerminalLinePage(10.5, [], stored), { name: "ArgumentOutOfRangeException", parameterName: "start" });
  });

  it("names the nested field it cannot read", () => {
    assert.throws(
      () => TerminalLinePage.fromJson({ start: 0, lines: [{ text: 5, wrapped: false, runs: [] }], stored: { start: 0, end: 1, dropped: 0 } }),
      { name: "JsonException", path: "$.lines.0.text" });
  });

  it("holds up to 500 lines, the most a page request asks for", () => {
    const line: TerminalLine = new TerminalLine("", false, []);
    const stored: TerminalLineRange = new TerminalLineRange(0, 1_000);

    assert.equal(new TerminalLinePage(0, new Array<TerminalLine>(500).fill(line), stored).lines.length, 500);
    assert.throws(() => new TerminalLinePage(0, new Array<TerminalLine>(501).fill(line), stored),
      { name: "ArgumentException", parameterName: "lines", message: "The value must hold at most 500 lines. (Parameter 'lines')" });
    assert.throws(() => TerminalLinePage.fromJson({ start: 0, lines: new Array<object>(501).fill({ text: 5 }), stored: { start: 0, end: 1_000, dropped: 0 } }),
      { name: "JsonException", path: "$.lines", message: "$.lines: Expected at most 500 items." });
  });

  it("refuses lines outside the stored lines at the lines' field when it reads them", () => {
    assert.throws(() => TerminalLinePage.fromJson({ start: 9, lines: [], stored: { start: 10, end: 12, dropped: 0 } }),
      { name: "JsonException", path: "$.lines" });
    assert.throws(() => TerminalLinePage.fromJson({ start: 0, lines: [], stored: { start: 5, end: 4, dropped: 0 } }),
      { name: "JsonException", path: "$.stored.end" });
  });
});
