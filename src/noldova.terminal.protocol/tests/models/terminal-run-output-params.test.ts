/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TerminalRunOutputParams } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalRunOutputParamsTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const json: object = { sessionId: "session-1", runId: "run-1", maximumLines: 2000 };
    const params: TerminalRunOutputParams = TerminalRunOutputParams.fromJson(json);

    Expect.same(["session-1", "run-1", 2000], [params.sessionId, params.runId, params.maximumLines]);
    Expect.same(json, params.toJson());
  }

  @TestMethod
  public takesFrom1To5000Lines(): void {
    for (const maximumLines of [1, 5000])
      Assert.areEqual(maximumLines, new TerminalRunOutputParams("session-1", "run-1", maximumLines).maximumLines);
  }

  @TestMethod
  public refusesABlankTerminalOrRunAndANumberOfLinesOutOfRangeOrNotWhole(): void {
    Expect.throwsMatching(() => new TerminalRunOutputParams(" ", "run-1", 1), { name: "ArgumentException", parameterName: "sessionId" });
    Expect.throwsMatching(() => new TerminalRunOutputParams("session-1", "", 1), { name: "ArgumentException", parameterName: "runId" });
    for (const maximumLines of [0, 5001, 1.5])
      Expect.throwsMatching(() => new TerminalRunOutputParams("session-1", "run-1", maximumLines), { name: "ArgumentOutOfRangeException", parameterName: "maximumLines",
        message: "The value must be a whole number from 1 to 5000. (Parameter 'maximumLines')" });
  }

  @TestMethod
  public refusesAMissingOrUnknownFieldAndANumberOfLinesOutOfRange(): void {
    const json: Record<string, unknown> = { sessionId: "session-1", runId: "run-1", maximumLines: 10 };

    Expect.throwsMatching(() => TerminalRunOutputParams.fromJson({ ...json, runId: undefined }), { name: "JsonException", path: "$.runId" });
    Expect.throwsMatching(() => TerminalRunOutputParams.fromJson({ ...json, sessionId: "" }), { name: "JsonException", path: "$.sessionId" });
    Expect.throwsMatching(() => TerminalRunOutputParams.fromJson({ ...json, maximumLines: 0 }), { name: "JsonException", path: "$.maximumLines" });
    Expect.throwsMatching(() => TerminalRunOutputParams.fromJson({ ...json, maximumLines: 5001 }), { name: "JsonException", path: "$.maximumLines" });
    Expect.throwsMatching(() => TerminalRunOutputParams.fromJson({ ...json, offset: 0 }), { name: "JsonException", path: "$.offset" });
  }
}
