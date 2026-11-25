/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TerminalVisibilityParams } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalVisibilityParamsTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    Assert.areEqual(false, TerminalVisibilityParams.fromJson({ sessionId: "s1", paneId: "p1", visible: false }).isVisible);
    Expect.same({ sessionId: "s1", paneId: "p1", visible: true }, new TerminalVisibilityParams("s1", "p1", true).toJson());
  }

  @TestMethod
  public refusesABlankPaneId(): void {
    Assert.throws(() => new TerminalVisibilityParams("s1", "", true), ArgumentException);
    Expect.throwsMatching(() => TerminalVisibilityParams.fromJson({ sessionId: "s1", paneId: "p1", visible: 1 }), { name: "JsonException", path: "$.visible" });
  }

  @TestMethod
  public refusesABlankSession(): void {
    for (const id of ["", " "])
      Expect.throwsMatching(() => new TerminalVisibilityParams(id, "p1", true), { name: "ArgumentException", parameterName: "sessionId" });
  }
}
