/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProtocolReader, TerminalInputEdge, TerminalInputMark } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalInputMarkTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const mark: TerminalInputMark = TerminalInputMark.fromReader(ProtocolReader.fromValue({ offset: 7, edge: "Start" }));

    Expect.same([7, TerminalInputEdge.Start], [mark.offset, mark.edge]);
    Expect.same({ offset: 9, edge: "End" }, new TerminalInputMark(9, TerminalInputEdge.End).toJson());
    Assert.areEqual(TerminalInputEdge.RightPrompt, TerminalInputMark.fromReader(ProtocolReader.fromValue({ offset: 3, edge: "RightPrompt" })).edge);
    Assert.areEqual(TerminalInputEdge.Continuation, TerminalInputMark.fromReader(ProtocolReader.fromValue({ offset: 4, edge: "Continuation" })).edge);
  }

  @TestMethod
  public refusesANegativeOrFractionalOffsetAndAnUnknownEdge(): void {
    Assert.throws(() => new TerminalInputMark(-1, TerminalInputEdge.Start), ArgumentException);
    Expect.throwsMatching(() => TerminalInputMark.fromReader(ProtocolReader.fromValue({ offset: 0.5, edge: "End" })), { name: "JsonException", path: "$.offset" });
    Expect.throwsMatching(() => TerminalInputMark.fromReader(ProtocolReader.fromValue({ offset: 0, edge: "start" })), { name: "JsonException", path: "$.edge" });
  }
}
