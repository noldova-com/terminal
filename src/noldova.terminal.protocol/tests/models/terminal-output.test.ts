/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalInputEdge } from "../../src/enums/terminal-input-edge.ts";
import { TerminalInputMark } from "../../src/models/terminal-input-mark.ts";
import { TerminalLineRange } from "../../src/models/terminal-line-range.ts";
import { TerminalOutput } from "../../src/models/terminal-output.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalOutputTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const output: TerminalOutput = TerminalOutput.fromJson({ sessionId: "s1", offset: 10, data: "héllo", stored: { start: 3, end: 9, dropped: 3 },
      inputs: [] });

    Assert.areEqual(10, output.offset);
    Assert.areEqual("héllo", output.data);
    Expect.same([3, 9, 3], [output.stored.start, output.stored.end, output.stored.dropped]);
    Expect.same({ sessionId: "s1", offset: 0, data: "x", stored: { start: 0, end: 2, dropped: 0 }, inputs: [] }, new TerminalOutput("s1", 0, "x", new TerminalLineRange(0, 2)).toJson());
  }

  @TestMethod
  public writesAndReadsTheLinesEdgesAtItsStartInsideAndAtItsEnd(): void {
    const json: object = {
      sessionId: "s1", offset: 10, data: "$ ls\r\n", stored: { start: 0, end: 0, dropped: 0 },
      inputs: [{ offset: 10, edge: "End" }, { offset: 12, edge: "Start" }, { offset: 16, edge: "End" }]
    };
    const output: TerminalOutput = TerminalOutput.fromJson(json);

    Expect.same([[10, TerminalInputEdge.End], [12, TerminalInputEdge.Start], [16, TerminalInputEdge.End]], output.inputs.map(t => [t.offset, t.edge]));
    Expect.same(json, output.toJson());
  }

  @TestMethod
  public refusesAnEdgeOutsideTheBatchOrOutOfOrder(): void {
    const stored: TerminalLineRange = new TerminalLineRange(0, 0);
    for (const inputs of [[new TerminalInputMark(9, TerminalInputEdge.Start)], [new TerminalInputMark(14, TerminalInputEdge.Start)],
      [new TerminalInputMark(12, TerminalInputEdge.Start), new TerminalInputMark(11, TerminalInputEdge.End)]])
      Expect.throwsMatching(() => new TerminalOutput("s1", 10, "abc", stored, inputs), { name: "ArgumentException", parameterName: "inputs" });
    Expect.throwsMatching(() => TerminalOutput.fromJson({ sessionId: "s1", offset: 0, data: "", stored: { start: 0, end: 0, dropped: 0 } }), { name: "JsonException", path: "$.inputs" });
    Expect.throwsMatching(() => TerminalOutput.fromJson({ sessionId: "s1", offset: 0, data: "", stored: { start: 0, end: 0, dropped: 0 },
      inputs: [{ offset: 0, edge: "Middle" }] }), { name: "JsonException", path: "$.inputs.0.edge" });
  }

  @TestMethod
  public endsItsOffsetAfterItsDataInUTF16CodeUnits(): void {
    Assert.areEqual(13, new TerminalOutput("s1", 10, "a\u{1F600}", new TerminalLineRange(0, 0)).endOffset);
  }

  @TestMethod
  public refusesAFractionalOffset(): void {
    Assert.throws(() => new TerminalOutput("s1", 0.5, "", new TerminalLineRange(0, 0)), ArgumentException);
    Expect.throwsMatching(() => TerminalOutput.fromJson({ sessionId: "s1", offset: 0.5, data: "", stored: { start: 0, end: 0, dropped: 0 }, inputs: [] }), { name: "JsonException", path: "$.offset" });
  }

  @TestMethod
  public refusesABlankSessionAndDataLongerThanOneBatch(): void {
    const stored: TerminalLineRange = new TerminalLineRange(0, 0);

    for (const sessionId of ["", " "])
      Expect.throwsMatching(() => new TerminalOutput(sessionId, 0, "", stored), { name: "ArgumentException", parameterName: "sessionId" });
    Expect.throwsMatching(() => new TerminalOutput("s1", 0, "d".repeat(1_048_577), stored), { name: "ArgumentException", parameterName: "data" });
  }

  @TestMethod
  public keepsItsOwnCopyOfTheEdges(): void {
    const inputs: TerminalInputMark[] = [new TerminalInputMark(0, TerminalInputEdge.Start)];
    const output: TerminalOutput = new TerminalOutput("s1", 0, "ls", new TerminalLineRange(0, 0), inputs);
    inputs.push(new TerminalInputMark(1, TerminalInputEdge.End));

    Assert.areEqual(1, output.inputs.length);
  }

  @TestMethod
  public refusesAnEdgeOutOfOrderAtTheEdgesFieldWhenItReadsThem(): void {
    Expect.throwsMatching(() => TerminalOutput.fromJson({ sessionId: "s1", offset: 10, data: "abc", stored: { start: 0, end: 0, dropped: 0 },
      inputs: [{ offset: 12, edge: "Start" }, { offset: 11, edge: "End" }] }), { name: "JsonException", path: "$.inputs" });
  }
}
