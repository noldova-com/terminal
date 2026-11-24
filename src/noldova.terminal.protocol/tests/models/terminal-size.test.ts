/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalSize } from "../../src/models/terminal-size.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalSizeTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const size: TerminalSize = TerminalSize.fromJson({ cols: 120, rows: 30 });

    Assert.areEqual(120, size.columns);
    Assert.areEqual(30, size.rows);
    Expect.same({ cols: 1, rows: 1000 }, new TerminalSize(1, 1000).toJson());
  }

  @TestMethod
  public comparesColumnsAndRows(): void {
    const size: TerminalSize = new TerminalSize(80, 24);

    Assert.areEqual(true, size.equals(new TerminalSize(80, 24)));
    Assert.areEqual(false, size.equals(new TerminalSize(81, 24)));
    Assert.areEqual(false, size.equals(new TerminalSize(80, 25)));
  }

  @TestMethod
  public refusesASizeOutside1To1000(): void {
    Assert.throws(() => new TerminalSize(0, 24), ArgumentException);
    Assert.throws(() => new TerminalSize(80, 1001), ArgumentException);
  }

  @TestMethod
  public namesTheFieldItCannotRead(): void {
    Expect.throwsMatching(() => TerminalSize.fromJson({ cols: 80, rows: 0 }), { name: "JsonException", path: "$.rows" });
    Assert.throws(() => TerminalSize.fromJson({ cols: 80, rows: 24, width: 1 }), JsonException);
  }
}
