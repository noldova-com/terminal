/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalInputStart } from "../../src/models/terminal-input-start.ts";
import { ProtocolReader } from "../../src/services/protocol.reader.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalInputStartTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const start: TerminalInputStart = TerminalInputStart.fromReader(ProtocolReader.fromValue({ rowsAbove: 2, column: 1_000, rightPrompt: null }));

    Expect.same([2, 1_000, null], [start.rowsAbove, start.column, start.rightPrompt]);
    Expect.same({ rowsAbove: 0, column: 5, rightPrompt: null }, new TerminalInputStart(0, 5).toJson());
  }

  @TestMethod
  public writesAndReadsARightPromptsColumnWhichIsNullWithoutOne(): void {
    const start: TerminalInputStart = TerminalInputStart.fromReader(ProtocolReader.fromValue({ rowsAbove: 0, column: 2, rightPrompt: 30 }));

    Expect.same([30, null], [start.rightPrompt, new TerminalInputStart(0, 2).rightPrompt]);
    Expect.same({ rowsAbove: 1, column: 2, rightPrompt: 30 }, new TerminalInputStart(1, 2, 30).toJson());
  }

  @TestMethod
  public refusesAStartWhoseRightPromptsFieldIsMissingSinceNullStandsForNone(): void {
    Expect.throwsMatching(() => TerminalInputStart.fromReader(ProtocolReader.fromValue({ rowsAbove: 0, column: 2 })), { name: "JsonException", path: "$.rightPrompt" });
  }

  @TestMethod
  public refusesRowsOrAColumnOutOfRange(): void {
    Assert.throws(() => new TerminalInputStart(-1, 0), ArgumentException);
    Assert.throws(() => new TerminalInputStart(0, 1_001), ArgumentException);
    Assert.throws(() => new TerminalInputStart(0, 0, 1_001), ArgumentException);
    Expect.throwsMatching(() => TerminalInputStart.fromReader(ProtocolReader.fromValue({ rowsAbove: 0, column: 0, rightPrompt: -1 })), { name: "JsonException", path: "$.rightPrompt" });
    Expect.throwsMatching(() => TerminalInputStart.fromReader(ProtocolReader.fromValue({ rowsAbove: 0, column: 0, rightPrompt: null, row: 1 })), { name: "JsonException", path: "$.row" });
  }
}
