/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalShowOwnerParams } from "../../src/models/terminal-show-owner-params.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalShowOwnerParamsTests {
  @TestMethod
  public writesAndReadsItsWireFormWithAnOwnerOrNoneShownOrHiddenAndAsShownWithoutIsHidden(): void {
    Assert.areEqual("example.chat/42", TerminalShowOwnerParams.fromJson({ owner: "example.chat/42" }).owner);
    Assert.areEqual(null, TerminalShowOwnerParams.fromJson({ owner: null }).owner);
    Expect.same([false, true], [TerminalShowOwnerParams.fromJson({ owner: null }).isHidden, TerminalShowOwnerParams.fromJson({ owner: null, isHidden: true }).isHidden]);
    Expect.same({ owner: "example.chat/7", isHidden: false }, new TerminalShowOwnerParams("example.chat/7").toJson());
    Expect.same({ owner: null, isHidden: true }, new TerminalShowOwnerParams(null, true).toJson());
  }

  @TestMethod
  public refusesABlankOrOverLongOwnerAMissingOneAndAnotherField(): void {
    for (const owner of ["", " ", "o".repeat(257)])
      Expect.throwsMatching(() => new TerminalShowOwnerParams(owner), { name: "ArgumentException", parameterName: "owner" });
    Expect.throwsMatching(() => TerminalShowOwnerParams.fromJson({ owner: 42 }), { name: "JsonException", path: "$.owner" });
    Expect.throwsMatching(() => TerminalShowOwnerParams.fromJson({}), { name: "JsonException", path: "$.owner" });
    Expect.throwsMatching(() => TerminalShowOwnerParams.fromJson({ owner: null, isHidden: "yes" }), { name: "JsonException", path: "$.isHidden" });
    Expect.throwsMatching(() => TerminalShowOwnerParams.fromJson({ owner: "a", sessionId: "s1" }), { name: "JsonException", path: "$.sessionId" });
  }
}
