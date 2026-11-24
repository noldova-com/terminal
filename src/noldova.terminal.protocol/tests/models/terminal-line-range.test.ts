/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalLineRange } from "../../src/models/terminal-line-range.ts";
import { ProtocolReader } from "../../src/services/protocol.reader.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalLineRangeTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const json: object = { start: 40, end: 1200, dropped: 25 };
    const range: TerminalLineRange = TerminalLineRange.fromReader(ProtocolReader.fromValue(json));

    Expect.same([40, 1200, 25], [range.start, range.end, range.dropped]);
    Expect.same(json, range.toJson());
  }

  @TestMethod
  public canBeEmptyWithNothingDroppedUnlessItSaysSo(): void {
    const range: TerminalLineRange = new TerminalLineRange(7, 7);

    Expect.same([7, 7, 0], [range.start, range.end, range.dropped]);
  }

  @TestMethod
  public canHaveDroppedEveryLineBeforeItsStart(): void {
    Assert.areEqual(7, new TerminalLineRange(7, 9, 7).dropped);
  }

  @TestMethod
  public refusesANegativeOrFractionalLineAnEndBeforeItsStartAndMoreDroppedThanComeBeforeIt(): void {
    Expect.throwsMatching(() => new TerminalLineRange(-1, 3), { name: "ArgumentOutOfRangeException", parameterName: "start" });
    Expect.throwsMatching(() => new TerminalLineRange(1.5, 3), { name: "ArgumentOutOfRangeException", parameterName: "start" });
    Expect.throwsMatching(() => new TerminalLineRange(1, 2.5), { name: "ArgumentOutOfRangeException", parameterName: "end" });
    Expect.throwsMatching(() => new TerminalLineRange(5, 4), { name: "ArgumentException", parameterName: "end" });
    for (const dropped of [-1, 0.5])
      Expect.throwsMatching(() => new TerminalLineRange(5, 6, dropped), { name: "ArgumentOutOfRangeException", parameterName: "dropped" });
    Expect.throwsMatching(() => new TerminalLineRange(5, 6, 6), { name: "ArgumentException", parameterName: "dropped" });
  }

  @TestMethod
  public namesTheFieldItCannotRead(): void {
    Expect.throwsMatching(() => TerminalLineRange.fromReader(ProtocolReader.fromValue({ start: 0, end: null, dropped: 0 })), { name: "JsonException", path: "$.end" });
    Expect.throwsMatching(() => TerminalLineRange.fromReader(ProtocolReader.fromValue({ start: 0, end: 0 })), { name: "JsonException", path: "$.dropped" });
  }

  @TestMethod
  public refusesAnEndBeforeItsStartAndMoreDroppedThanComeBeforeItAtTheirFieldsWhenItReadsThem(): void {
    Expect.throwsMatching(() => TerminalLineRange.fromReader(ProtocolReader.fromValue({ start: 5, end: 4, dropped: 0 }, "$.stored")), { name: "JsonException", path: "$.stored.end" });
    Expect.throwsMatching(() => TerminalLineRange.fromReader(ProtocolReader.fromValue({ start: 5, end: 6, dropped: 6 })), { name: "JsonException", path: "$.dropped" });
  }
}
