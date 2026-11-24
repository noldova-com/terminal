/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalLine } from "../../src/models/terminal-line.ts";
import { TerminalLinePage } from "../../src/models/terminal-line-page.ts";
import { TerminalLineRange } from "../../src/models/terminal-line-range.ts";
import { TerminalTextRun } from "../../src/models/terminal-text-run.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalLinePageTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const json: object = {
      start: 10,
      lines: [
        { text: "one", wrapped: false, runs: [{ length: 3, foreground: -1, background: -1, style: 0 }] },
        { text: "", wrapped: false, runs: [] }
      ],
      stored: { start: 10, end: 12, dropped: 4 }
    };
    const page: TerminalLinePage = TerminalLinePage.fromJson(json);

    Expect.same([10, "one", 12], [page.start, page.lines[0]?.text, page.stored.end]);
    Expect.same(json, page.toJson());
  }

  @TestMethod
  public canBeAnEmptyPageAtTheEndOfTheStoredLines(): void {
    Assert.areEqual(0, new TerminalLinePage(12, [], new TerminalLineRange(10, 12)).lines.length);
  }

  @TestMethod
  public keepsItsOwnCopyOfItsLines(): void {
    const lines: TerminalLine[] = [new TerminalLine("a", false, [new TerminalTextRun(1, -1, -1, 0)])];
    const page: TerminalLinePage = new TerminalLinePage(0, lines, new TerminalLineRange(0, 2));
    lines.push(new TerminalLine("", false, []));

    Assert.areEqual(1, page.lines.length);
  }

  @TestMethod
  public refusesLinesOutsideTheStoredLines(): void {
    const line: TerminalLine = new TerminalLine("", false, []);
    const stored: TerminalLineRange = new TerminalLineRange(10, 12);

    Expect.throwsMatching(() => new TerminalLinePage(9, [], stored), { name: "ArgumentException", parameterName: "lines" });
    Expect.throwsMatching(() => new TerminalLinePage(11, [line, line], stored), { name: "ArgumentException", parameterName: "lines" });
    Expect.throwsMatching(() => new TerminalLinePage(13, [], stored), { name: "ArgumentException", parameterName: "lines" });
    Expect.throwsMatching(() => new TerminalLinePage(10.5, [], stored), { name: "ArgumentOutOfRangeException", parameterName: "start" });
  }

  @TestMethod
  public namesTheNestedFieldItCannotRead(): void {
    Expect.throwsMatching(() => TerminalLinePage.fromJson({ start: 0, lines: [{ text: 5, wrapped: false, runs: [] }], stored: { start: 0, end: 1, dropped: 0 } }), { name: "JsonException", path: "$.lines.0.text" });
  }

  @TestMethod
  public holdsUpTo500LinesTheMostAPageRequestAsksFor(): void {
    const line: TerminalLine = new TerminalLine("", false, []);
    const stored: TerminalLineRange = new TerminalLineRange(0, 1_000);

    Assert.areEqual(500, new TerminalLinePage(0, new Array<TerminalLine>(500).fill(line), stored).lines.length);
    Expect.throwsMatching(() => new TerminalLinePage(0, new Array<TerminalLine>(501).fill(line), stored), { name: "ArgumentException", parameterName: "lines", message: "The value must hold at most 500 lines. (Parameter 'lines')" });
    Expect.throwsMatching(() => TerminalLinePage.fromJson({ start: 0, lines: new Array<object>(501).fill({ text: 5 }), stored: { start: 0, end: 1_000, dropped: 0 } }), { name: "JsonException", path: "$.lines", message: "$.lines: Expected at most 500 items." });
  }

  @TestMethod
  public refusesLinesOutsideTheStoredLinesAtTheLinesFieldWhenItReadsThem(): void {
    Expect.throwsMatching(() => TerminalLinePage.fromJson({ start: 9, lines: [], stored: { start: 10, end: 12, dropped: 0 } }), { name: "JsonException", path: "$.lines" });
    Expect.throwsMatching(() => TerminalLinePage.fromJson({ start: 0, lines: [], stored: { start: 5, end: 4, dropped: 0 } }), { name: "JsonException", path: "$.stored.end" });
  }
}
