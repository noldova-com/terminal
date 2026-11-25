/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TerminalCompleteParams } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalCompleteParamsTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const json: object = { sessionId: "s1", line: "git checkout ma", cursor: 15, asksShell: true };
    const params: TerminalCompleteParams = TerminalCompleteParams.fromJson(json);

    Expect.same(["s1", "git checkout ma", 15, true], [params.sessionId, params.line, params.cursor, params.asksShell]);
    Expect.same(json, params.toJson());
  }

  @TestMethod
  public asksOnlyTheRuntimeWhenAsksShellIsLeftOut(): void {
    Assert.areEqual(false, TerminalCompleteParams.fromJson({ sessionId: "s1", line: "ls", cursor: 2 }).asksShell);
    Assert.areEqual(false, new TerminalCompleteParams("s1", "ls", 2).asksShell);
  }

  @TestMethod
  public takesAnEmptyLineAndALineOf4096CodeUnitsWithTheCursorAtEitherEnd(): void {
    Assert.areEqual(0, new TerminalCompleteParams("s1", "", 0).cursor);
    Assert.areEqual(4_096, new TerminalCompleteParams("s1", "x".repeat(4_096), 4_096).cursor);
    Assert.areEqual(0, new TerminalCompleteParams("s1", "x".repeat(4_096), 0).cursor);
  }

  @TestMethod
  public refusesABlankSessionALongerLineAndACursorOutsideTheLineOrBetweenCodeUnits(): void {
    Expect.throwsMatching(() => new TerminalCompleteParams(" ", "ls", 2), { name: "ArgumentException", parameterName: "sessionId" });
    Expect.throwsMatching(() => new TerminalCompleteParams("s1", "x".repeat(4_097), 0), { name: "ArgumentException", parameterName: "line" });
    for (const cursor of [-1, 3, 1.5])
      Expect.throwsMatching(() => new TerminalCompleteParams("s1", "ls", cursor), { name: "ArgumentOutOfRangeException", parameterName: "cursor" });
  }

  @TestMethod
  public namesTheFieldItCannotRead(): void {
    Expect.throwsMatching(() => TerminalCompleteParams.fromJson({ sessionId: "s1", line: "ls", cursor: 3 }), { name: "JsonException", path: "$.cursor" });
    Expect.throwsMatching(() => TerminalCompleteParams.fromJson({ sessionId: "s1", line: 7, cursor: 0 }), { name: "JsonException", path: "$.line" });
    Expect.throwsMatching(() => TerminalCompleteParams.fromJson({ sessionId: "s1", line: "ls", cursor: 0, shell: "bash" }), { name: "JsonException" });
    Expect.throwsMatching(() => TerminalCompleteParams.fromJson({ sessionId: "s1", line: "ls", cursor: 0, asksShell: "yes" }), { name: "JsonException", path: "$.asksShell" });
  }
}
