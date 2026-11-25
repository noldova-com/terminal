/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TerminalReference } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalReferenceTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    Assert.areEqual("s1", TerminalReference.fromJson({ sessionId: "s1" }).sessionId);
    Expect.same({ sessionId: "s2" }, new TerminalReference("s2").toJson());
  }

  @TestMethod
  public refusesABlankSessionId(): void {
    Assert.throws(() => new TerminalReference(""), ArgumentException);
    Expect.throwsMatching(() => TerminalReference.fromJson({ sessionId: 1 }), { name: "JsonException", path: "$.sessionId" });
  }
}
