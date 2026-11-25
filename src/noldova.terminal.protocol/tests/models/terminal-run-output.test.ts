/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TerminalLine, TerminalRunOutput, TerminalTextRun } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalRunOutputTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const json: object = {
      lines: [
        { text: "$ ls", wrapped: false, runs: [{ length: 4, foreground: 2, background: -1, style: 1 }] },
        { text: "", wrapped: false, runs: [] }
      ],
      cutLines: 3
    };
    const output: TerminalRunOutput = TerminalRunOutput.fromJson(json);

    Expect.same([2, "$ ls", 2, 3], [output.lines.length, output.lines[0]?.text, output.lines[0]?.runs[0]?.foreground, output.cutLines]);
    Expect.same(json, output.toJson());
  }

  @TestMethod
  public canHoldNoLinesAndUpTo5000AndKeepsItsOwnCopyOfThem(): void {
    const line: TerminalLine = new TerminalLine("a", false, [new TerminalTextRun(1, -1, -1, 0)]);
    const lines: TerminalLine[] = [line];
    const output: TerminalRunOutput = new TerminalRunOutput(lines, 0);
    lines.push(line);

    Assert.areEqual(1, output.lines.length);
    Assert.areEqual(0, new TerminalRunOutput([], Number.MAX_SAFE_INTEGER).lines.length);
    Assert.areEqual(5000, new TerminalRunOutput(new Array<TerminalLine>(5000).fill(line), 0).lines.length);
  }

  @TestMethod
  public refusesMoreThan5000LinesAndCutLinesThatArentAWholeNumberOfAtLeast0(): void {
    const line: TerminalLine = new TerminalLine("", false, []);

    Expect.throwsMatching(() => new TerminalRunOutput(new Array<TerminalLine>(5001).fill(line), 0), { name: "ArgumentException", parameterName: "lines", message: "The value must hold at most 5000 lines. (Parameter 'lines')" });
    for (const cutLines of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1])
      Expect.throwsMatching(() => new TerminalRunOutput([], cutLines), { name: "ArgumentOutOfRangeException", parameterName: "cutLines" });
  }

  @TestMethod
  public refusesAMissingOrUnknownFieldAndNamesTheNestedFieldItCannotRead(): void {
    Expect.throwsMatching(() => TerminalRunOutput.fromJson({ lines: [] }), { name: "JsonException", path: "$.cutLines" });
    Expect.throwsMatching(() => TerminalRunOutput.fromJson({ lines: [], cutLines: -1 }), { name: "JsonException", path: "$.cutLines" });
    Expect.throwsMatching(() => TerminalRunOutput.fromJson({ lines: [], cutLines: 0, start: 0 }), { name: "JsonException", path: "$.start" });
    Expect.throwsMatching(() => TerminalRunOutput.fromJson({ lines: [{ text: 5, wrapped: false, runs: [] }], cutLines: 0 }), { name: "JsonException", path: "$.lines.0.text" });
  }

  @TestMethod
  public countsTheLinesItReadsBeforeItReadsAny(): void {
    Expect.throwsMatching(() => TerminalRunOutput.fromJson({ lines: new Array<object>(5001).fill({ text: 5 }), cutLines: 0 }), { name: "JsonException", path: "$.lines", message: "$.lines: Expected at most 5000 items." });
  }
}
