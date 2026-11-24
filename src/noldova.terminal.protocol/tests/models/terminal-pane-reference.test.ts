/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalPaneReference } from "../../src/models/terminal-pane-reference.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalPaneReferenceTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const reference: TerminalPaneReference = TerminalPaneReference.fromJson({ sessionId: "s1", paneId: "p1" });

    Assert.areEqual("s1", reference.sessionId);
    Assert.areEqual("p1", reference.paneId);
    Expect.same({ sessionId: "s2", paneId: "p2" }, new TerminalPaneReference("s2", "p2").toJson());
  }

  @TestMethod
  public refusesABlankPaneId(): void {
    Assert.throws(() => new TerminalPaneReference("s1", " "), ArgumentException);
    Expect.throwsMatching(() => TerminalPaneReference.fromJson({ sessionId: "s1" }), { name: "JsonException", path: "$.paneId" });
  }

  @TestMethod
  public refusesABlankSession(): void {
    for (const id of ["", " "])
      Expect.throwsMatching(() => new TerminalPaneReference(id, "p1"), { name: "ArgumentException", parameterName: "sessionId" });
  }
}
