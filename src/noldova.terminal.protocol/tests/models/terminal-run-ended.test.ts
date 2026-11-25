/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestClass, TestMethod } from "@noldova/context.testing";
import { TerminalRunEnded, TerminalRunEndedBy } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalRunEndedTests {
  @TestMethod
  public writesAndReadsEachWayARunEndsWithTheLastCommandsCodeOnlyWhenItsShellMarkedIt(): void {
    const json: object = { sessionId: "s1", runId: "r1", endedBy: "Command", exitCode: 3 };

    Expect.same(json, TerminalRunEnded.fromJson(json).toJson());
    for (const endedBy of Object.values(TerminalRunEndedBy))
      Expect.same({ sessionId: "s1", runId: "r1", endedBy, exitCode: null }, new TerminalRunEnded("s1", "r1", endedBy, null).toJson());
  }

  @TestMethod
  public refusesACodeForAnEndTheShellDidntMarkACodeOutOfRangeABlankIdAnUnknownEndAndAnotherField(): void {
    for (const endedBy of [TerminalRunEndedBy.NoIntegration, TerminalRunEndedBy.TerminalEnded])
      Expect.throwsMatching(() => new TerminalRunEnded("s1", "r1", endedBy, 0), { name: "ArgumentException", parameterName: "exitCode",
        message: "The value must give an exitCode only when endedBy is Command. (Parameter 'exitCode')" });
    Expect.throwsMatching(() => new TerminalRunEnded("s1", "r1", TerminalRunEndedBy.Command, 4_294_967_296), { name: "ArgumentOutOfRangeException", parameterName: "exitCode" });
    Expect.throwsMatching(() => new TerminalRunEnded("s1", " ", TerminalRunEndedBy.Command, 0), { name: "ArgumentException", parameterName: "runId" });
    Expect.throwsMatching(() => new TerminalRunEnded(" ", "r1", TerminalRunEndedBy.Command, 0), { name: "ArgumentException", parameterName: "sessionId" });
    Expect.throwsMatching(() => TerminalRunEnded.fromJson({ sessionId: "s1", runId: "r1", endedBy: "Exit", exitCode: null }), { name: "JsonException", path: "$.endedBy" });
    Expect.throwsMatching(() => TerminalRunEnded.fromJson({ sessionId: "s1", runId: "r1", endedBy: "Command" }), { name: "JsonException", path: "$.exitCode" });
    Expect.throwsMatching(() => TerminalRunEnded.fromJson({ sessionId: "s1", runId: "r1", endedBy: "NoIntegration", exitCode: 0 }), { name: "JsonException", path: "$.exitCode" });
    Expect.throwsMatching(() => TerminalRunEnded.fromJson({ sessionId: "s1", runId: "r1", endedBy: "Command", exitCode: 0, at: 1 }), { name: "JsonException", path: "$.at" });
  }
}
