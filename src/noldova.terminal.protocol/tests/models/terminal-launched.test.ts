/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TerminalLaunched } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalLaunchedTests {
  @TestMethod
  public writesAndReadsALaunchedTerminalAndAMissingFolder(): void {
    for (const json of [{ sessionId: "session-1", missingFolder: null }, { sessionId: null, missingFolder: "/gone" }])
      Expect.same(json, TerminalLaunched.fromJson(json).toJson());
    Assert.areEqual("session-1", new TerminalLaunched("session-1", null).sessionId);
    Assert.areEqual("C:\\gone", new TerminalLaunched(null, "C:\\gone").missingFolder);
  }

  @TestMethod
  public refusesBothOrNeither(): void {
    for (const [sessionId, missingFolder] of [["session-1", "/gone"], [null, null]] as const)
      Expect.throwsMatching(() => new TerminalLaunched(sessionId, missingFolder), { name: "ArgumentException", parameterName: "sessionId", message: "The value must give either sessionId or missingFolder, not both or neither. (Parameter 'sessionId')" });
  }

  @TestMethod
  public refusesABlankSessionOrARelativeFolderAndAMissingOrUnknownField(): void {
    Expect.throwsMatching(() => new TerminalLaunched(" ", null), { name: "ArgumentException", parameterName: "sessionId" });
    Expect.throwsMatching(() => new TerminalLaunched(null, "gone"), { name: "ArgumentException", parameterName: "missingFolder" });
    Expect.throwsMatching(() => TerminalLaunched.fromJson({ sessionId: "session-1" }), { name: "JsonException", path: "$.missingFolder" });
    Expect.throwsMatching(() => TerminalLaunched.fromJson({ sessionId: null, missingFolder: "gone" }), { name: "JsonException", path: "$.missingFolder" });
    Expect.throwsMatching(() => TerminalLaunched.fromJson({ sessionId: null, missingFolder: null }), { name: "JsonException", path: "$.sessionId" });
    Expect.throwsMatching(() => TerminalLaunched.fromJson({ sessionId: "session-1", missingFolder: null, owner: null }), { name: "JsonException", path: "$.owner" });
  }
}
