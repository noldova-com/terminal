/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TerminalFindCommandsParams } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalFindCommandsParamsTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const json: object = { sessionId: "s1", names: ["git", "gti"] };
    const params: TerminalFindCommandsParams = TerminalFindCommandsParams.fromJson(json);

    Expect.same(["s1", ["git", "gti"]], [params.sessionId, params.names]);
    Expect.same(json, params.toJson());
  }

  @TestMethod
  public takesNoNamesAnd64Names(): void {
    Expect.same([], new TerminalFindCommandsParams("s1", []).names);
    Assert.areEqual(64, new TerminalFindCommandsParams("s1", Array.from({ length: 64 }, () => "ls")).names.length);
  }

  @TestMethod
  public refusesABlankSessionABlankNameAndA65thName(): void {
    Expect.throwsMatching(() => new TerminalFindCommandsParams(" ", ["ls"]), { name: "ArgumentException", parameterName: "sessionId" });
    Expect.throwsMatching(() => new TerminalFindCommandsParams("s1", [""]), { name: "ArgumentException", parameterName: "names" });
    Expect.throwsMatching(() => new TerminalFindCommandsParams("s1", Array.from({ length: 65 }, () => "ls")), { name: "ArgumentException", parameterName: "names" });
  }

  @TestMethod
  public namesTheFieldItCannotRead(): void {
    Expect.throwsMatching(() => TerminalFindCommandsParams.fromJson({ sessionId: "s1", names: "ls" }), { name: "JsonException", path: "$.names" });
    Expect.throwsMatching(() => TerminalFindCommandsParams.fromJson({ sessionId: "s1", names: [7] }), { name: "JsonException", path: "$.names.0" });
    Expect.throwsMatching(() => TerminalFindCommandsParams.fromJson({ sessionId: "s1", names: Array.from({ length: 65 }, () => "ls") }), { name: "JsonException", path: "$.names" });
    Expect.throwsMatching(() => TerminalFindCommandsParams.fromJson({ sessionId: "s1", names: [], shell: "bash" }), { name: "JsonException" });
  }

  @TestMethod
  public keepsItsOwnCopyOfTheNames(): void {
    const names: string[] = ["git"];
    const params: TerminalFindCommandsParams = new TerminalFindCommandsParams("s1", names);
    names.push("npm");

    Expect.same(["git"], params.names);
  }
}
