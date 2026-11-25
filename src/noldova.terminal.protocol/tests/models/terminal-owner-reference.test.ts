/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TerminalOwnerReference } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalOwnerReferenceTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    Assert.areEqual("example.chat/42", TerminalOwnerReference.fromJson({ owner: "example.chat/42" }).owner);
    Expect.same({ owner: "example.chat/7" }, new TerminalOwnerReference("example.chat/7").toJson());
  }

  @TestMethod
  public refusesABlankOrOverLongOwnerAndAnotherField(): void {
    for (const owner of ["", " ", "o".repeat(257)])
      Expect.throwsMatching(() => new TerminalOwnerReference(owner), { name: "ArgumentException", parameterName: "owner" });
    Expect.throwsMatching(() => TerminalOwnerReference.fromJson({ owner: 42 }), { name: "JsonException", path: "$.owner" });
    Expect.throwsMatching(() => TerminalOwnerReference.fromJson({ owner: "a", sessionId: "s1" }), { name: "JsonException", path: "$.sessionId" });
  }
}
