/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TerminalResizeParams, TerminalSize } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalResizeParamsTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const params: TerminalResizeParams = TerminalResizeParams.fromJson({ sessionId: "s1", size: { cols: 132, rows: 50 } });

    Assert.areEqual(132, params.size.columns);
    Expect.same({ sessionId: "s1", size: { cols: 80, rows: 24 } }, new TerminalResizeParams("s1", new TerminalSize(80, 24)).toJson());
  }

  @TestMethod
  public refusesABlankSessionId(): void {
    Assert.throws(() => new TerminalResizeParams("", new TerminalSize(80, 24)), ArgumentException);
    Expect.throwsMatching(() => TerminalResizeParams.fromJson({ sessionId: "s1", size: null }), { name: "JsonException", path: "$.size" });
  }
}
