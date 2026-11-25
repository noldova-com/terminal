/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TerminalLine, TerminalTextRun } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalLineTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const json: object = {
      text: "ok done",
      wrapped: true,
      runs: [{ length: 2, foreground: 2, background: -1, style: 1 }, { length: 5, foreground: -1, background: -1, style: 0 }]
    };
    const line: TerminalLine = TerminalLine.fromJson(json);

    Expect.same(["ok done", true, 2], [line.text, line.isWrapped, line.runs.length]);
    Expect.same(json, line.toJson());
  }

  @TestMethod
  public keepsABlankLineWithoutRuns(): void {
    const line: TerminalLine = new TerminalLine("", false, []);

    Expect.same([0, false], [line.runs.length, line.isWrapped]);
  }

  @TestMethod
  public keepsItsOwnCopyOfItsRuns(): void {
    const runs: TerminalTextRun[] = [new TerminalTextRun(2, -1, -1, 0)];
    const line: TerminalLine = new TerminalLine("hi", false, runs);
    runs.push(new TerminalTextRun(1, -1, -1, 0));

    Assert.areEqual(1, line.runs.length);
  }

  @TestMethod
  public refusesRunsThatDontCoverItsTextExactly(): void {
    Expect.throwsMatching(() => new TerminalLine("abc", false, [new TerminalTextRun(2, -1, -1, 0)]), { name: "ArgumentException", parameterName: "runs" });
    Expect.throwsMatching(() => new TerminalLine("ab", false, [new TerminalTextRun(3, -1, -1, 0)]), { name: "ArgumentException", parameterName: "runs" });
    Expect.throwsMatching(() => new TerminalLine("ab", false, []), { name: "ArgumentException", parameterName: "runs" });
  }

  @TestMethod
  public namesTheNestedFieldItCannotRead(): void {
    Expect.throwsMatching(() => TerminalLine.fromJson({ text: "ab", wrapped: false, runs: [{ length: "2", foreground: -1, background: -1, style: 0 }] }), { name: "JsonException", path: "$.runs.0.length" });
  }

  @TestMethod
  public refusesTextLongerThanAStoredLineHolds(): void {
    Expect.throwsMatching(() => new TerminalLine("t".repeat(1_048_577), false, []), { name: "ArgumentException", parameterName: "text" });
  }

  @TestMethod
  public refusesRunsThatDontCoverItsTextAtTheRunsFieldWhenItReadsThem(): void {
    Expect.throwsMatching(() => TerminalLine.fromJson({ text: "abc", wrapped: false, runs: [] }), { name: "JsonException", path: "$.runs" });
  }
}
