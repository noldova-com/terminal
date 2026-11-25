/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TerminalCommandEnded } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalCommandEndedTests {
  @TestMethod
  public writesAndReadsItsWireFormWithOrWithoutAnExitCode(): void {
    const json: object = { sessionId: "s1", exitCode: 1 };
    const unknown: object = { sessionId: "s1", exitCode: null };

    Expect.same([1, null], [TerminalCommandEnded.fromJson(json).exitCode, TerminalCommandEnded.fromJson(unknown).exitCode]);
    Expect.same([json, unknown], [new TerminalCommandEnded("s1", 1).toJson(), new TerminalCommandEnded("s1", null).toJson()]);
  }

  @TestMethod
  public refusesABlankSessionAnExitCodeOutOfRangeAMissingExitCodeAndAnotherField(): void {
    Assert.throws(() => new TerminalCommandEnded(" ", 0), ArgumentException);
    Assert.throws(() => new TerminalCommandEnded("s1", 4_294_967_296), ArgumentException);
    Assert.throws(() => new TerminalCommandEnded("s1", 1.5), ArgumentException);
    Expect.throwsMatching(() => TerminalCommandEnded.fromJson({ sessionId: "s1" }), { name: "JsonException", path: "$.exitCode" });
    Expect.throwsMatching(() => TerminalCommandEnded.fromJson({ sessionId: "s1", exitCode: 0, endedBy: "Exit" }), { name: "JsonException" });
  }
}
