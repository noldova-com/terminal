/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProtocolReader, TerminalTextRun, TerminalTextStyle } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalTextRunTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const json: object = { length: 5, foreground: 1, background: 0x1102030, style: 9 };
    const run: TerminalTextRun = TerminalTextRun.fromReader(ProtocolReader.fromValue(json));

    Expect.same([5, 1, 0x1102030, TerminalTextStyle.Bold | TerminalTextStyle.Underline], [run.length, run.foreground, run.background, run.style]);
    Expect.same(json, run.toJson());
  }

  @TestMethod
  public takesTheDefaultColorPaletteColorsAndRGBColorsAndEveryStyle(): void {
    for (const color of [-1, 0, 255, 0x1000000, 0x1ffffff])
      Expect.same([color, color], [new TerminalTextRun(1, color, -1, 0).foreground, new TerminalTextRun(1, -1, color, 0).background]);
    Assert.areEqual(0x1ff, new TerminalTextRun(1, -1, -1, 0x1ff).style);
  }

  @TestMethod
  public refusesAnEmptyRunAColorOutsideTheThreeKindsAndAnUnknownStyle(): void {
    for (const length of [0, 1.5])
      Expect.throwsMatching(() => new TerminalTextRun(length, -1, -1, 0), { name: "ArgumentOutOfRangeException", parameterName: "length" });
    for (const color of [-2, 256, 0xffffff, 0x2000000, 1.5]) {
      Expect.throwsMatching(() => new TerminalTextRun(1, color, -1, 0), { name: "ArgumentException", parameterName: "foreground" });
      Expect.throwsMatching(() => new TerminalTextRun(1, -1, color, 0), { name: "ArgumentException", parameterName: "background" });
    }
    for (const style of [-1, 512, 0.5])
      Expect.throwsMatching(() => new TerminalTextRun(1, -1, -1, style), { name: "ArgumentOutOfRangeException", parameterName: "style" });
  }

  @TestMethod
  public namesTheFieldItCannotRead(): void {
    Expect.throwsMatching(() => TerminalTextRun.fromReader(ProtocolReader.fromValue({ length: 1, foreground: "red", background: -1, style: 0 })), { name: "JsonException", path: "$.foreground" });
  }

  @TestMethod
  public refusesAColorBetweenThePaletteAndRGBColorsAtItsFieldWhenItReadsOne(): void {
    Expect.throwsMatching(() => TerminalTextRun.fromReader(ProtocolReader.fromValue({ length: 1, foreground: 256, background: -1, style: 0 })), { name: "JsonException", path: "$.foreground" });
    Expect.throwsMatching(() => TerminalTextRun.fromReader(ProtocolReader.fromValue({ length: 1, foreground: -1, background: 0xffffff, style: 0 })), { name: "JsonException", path: "$.background" });
  }
}
