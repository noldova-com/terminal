/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalRunEndedBy } from "../../src/enums/terminal-run-ended-by.ts";
import { TerminalRunOutcome } from "../../src/enums/terminal-run-outcome.ts";
import { TerminalRunEnded } from "../../src/models/terminal-run-ended.ts";
import { TerminalRunResult } from "../../src/models/terminal-run-result.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalRunResultTests {
  @TestMethod
  public writesAndReadsEachOutcomeWithARunIdExactlyWhenTheCommandsWereTyped(): void {
    Expect.same({ sessionId: "session-1", outcome: "Typed", runId: "run-1", endedRuns: [] }, TerminalRunResult.fromJson({ sessionId: "session-1", outcome: "Typed", runId: "run-1", endedRuns: [] }).toJson());
    for (const outcome of [TerminalRunOutcome.Input, TerminalRunOutcome.Tab, TerminalRunOutcome.Ended, TerminalRunOutcome.Busy])
      Expect.same({ sessionId: "session-1", outcome, runId: null, endedRuns: [] }, TerminalRunResult.fromJson({ sessionId: "session-1", outcome, runId: null, endedRuns: [] }).toJson());
    Assert.areEqual("Tab", new TerminalRunResult("session-1", TerminalRunOutcome.Tab).outcome);
    Assert.areEqual(null, new TerminalRunResult("session-1", TerminalRunOutcome.Tab).runId);
    Assert.areEqual("run-1", new TerminalRunResult("session-1", TerminalRunOutcome.Typed, "run-1").runId);
  }

  @TestMethod
  public writesAndReadsARunThatFoundNoShellOfItsKindsWhichNamesNoTerminal(): void {
    Expect.same({ sessionId: null, outcome: "NoShell", runId: null, endedRuns: [] }, TerminalRunResult.fromJson({ sessionId: null, outcome: "NoShell", runId: null, endedRuns: [] }).toJson());
    Assert.areEqual(null, new TerminalRunResult(null, TerminalRunOutcome.NoShell).sessionId);
  }

  @TestMethod
  public refusesNoTerminalWithAnotherOutcomeAndATerminalWithNoShell(): void {
    for (const outcome of [TerminalRunOutcome.Typed, TerminalRunOutcome.Input, TerminalRunOutcome.Tab, TerminalRunOutcome.Ended, TerminalRunOutcome.Busy])
      Expect.throwsMatching(() => new TerminalRunResult(null, outcome, "run-1"), { name: "ArgumentException", parameterName: "sessionId",
        message: "The value must give a sessionId unless its outcome is NoShell, and none when it is. (Parameter 'sessionId')" });
    Expect.throwsMatching(() => new TerminalRunResult("session-1", TerminalRunOutcome.NoShell), { name: "ArgumentException", parameterName: "sessionId" });
    Expect.throwsMatching(() => TerminalRunResult.fromJson({ sessionId: null, outcome: "Typed", runId: "run-1", endedRuns: [] }), { name: "JsonException", path: "$.sessionId",
      message: "$.sessionId: The value must give a sessionId unless its outcome is NoShell, and none when it is. (Parameter 'sessionId')" });
  }

  @TestMethod
  public refusesATypedRunWithoutARunIdAndARunIdWithAnotherOutcome(): void {
    Expect.throwsMatching(() => new TerminalRunResult("session-1", TerminalRunOutcome.Typed), { name: "ArgumentException", parameterName: "runId",
      message: "The value must give a runId when its outcome is Typed, and none when it isn't. (Parameter 'runId')" });
    for (const outcome of [TerminalRunOutcome.Input, TerminalRunOutcome.Tab, TerminalRunOutcome.Ended, TerminalRunOutcome.Busy])
      Expect.throwsMatching(() => new TerminalRunResult("session-1", outcome, "run-1"), { name: "ArgumentException", parameterName: "runId" });
    Expect.throwsMatching(() => new TerminalRunResult(null, TerminalRunOutcome.NoShell, "run-1"), { name: "ArgumentException", parameterName: "runId" });
    Expect.throwsMatching(() => TerminalRunResult.fromJson({ sessionId: "session-1", outcome: "Typed", runId: null, endedRuns: [] }), { name: "JsonException", path: "$.runId" });
  }

  @TestMethod
  public writesAndReadsTheEndsTheRuntimeKnewAsItTypedTheRunAndRefusesThemForARunItDidntType(): void {
    const ended: object = { sessionId: "session-1", runId: "run-0", endedBy: "Command", exitCode: null };
    const own: object = { sessionId: "session-1", runId: "run-1", endedBy: "NoIntegration", exitCode: null };
    const json: object = { sessionId: "session-1", outcome: "Typed", runId: "run-1", endedRuns: [ended, own] };

    Expect.same(json, TerminalRunResult.fromJson(json).toJson());
    Expect.same(["Command", "NoIntegration"], TerminalRunResult.fromJson(json).endedRuns.map(t => t.endedBy));
    Expect.same([], new TerminalRunResult("session-1", TerminalRunOutcome.Typed, "run-1").endedRuns);
    Expect.throwsMatching(() => new TerminalRunResult("session-1", TerminalRunOutcome.Busy, null,
      [new TerminalRunEnded("session-1", "run-0", TerminalRunEndedBy.TerminalEnded, null)]), { name: "ArgumentException", parameterName: "endedRuns",
      message: "The value must give endedRuns only when its outcome is Typed. (Parameter 'endedRuns')" });
    Expect.throwsMatching(() => TerminalRunResult.fromJson({ sessionId: "session-1", outcome: "Typed", runId: "run-1" }), { name: "JsonException", path: "$.endedRuns" });
    Expect.throwsMatching(() => TerminalRunResult.fromJson({ ...json, endedRuns: [{ ...ended, endedBy: "Exit" }] }), { name: "JsonException", path: "$.endedRuns.0.endedBy" });
    Expect.throwsMatching(() => TerminalRunResult.fromJson({ ...json, outcome: "Busy", runId: null }), { name: "JsonException", path: "$.endedRuns" });
    Expect.throwsMatching(() => TerminalRunResult.fromJson({ ...json, endedRuns: [ended, { ...own, endedBy: "TerminalEnded", exitCode: 1 }] }), { name: "JsonException", path: "$.endedRuns.1.exitCode" });
  }

  @TestMethod
  public refusesABlankSessionOrRunAnUnknownOutcomeAndAMissingOrUnknownField(): void {
    Expect.throwsMatching(() => new TerminalRunResult(" ", TerminalRunOutcome.Typed, "run-1"), { name: "ArgumentException", parameterName: "sessionId" });
    Expect.throwsMatching(() => new TerminalRunResult("session-1", TerminalRunOutcome.Typed, " "), { name: "ArgumentException", parameterName: "runId" });
    Expect.throwsMatching(() => TerminalRunResult.fromJson({ sessionId: "session-1", outcome: "Ran", runId: null, endedRuns: [] }), { name: "JsonException", path: "$.outcome" });
    Expect.throwsMatching(() => TerminalRunResult.fromJson({ sessionId: "session-1", runId: null, endedRuns: [] }), { name: "JsonException", path: "$.outcome" });
    Expect.throwsMatching(() => TerminalRunResult.fromJson({ sessionId: "session-1", outcome: "Typed", endedRuns: [] }), { name: "JsonException", path: "$.runId" });
    Expect.throwsMatching(() => TerminalRunResult.fromJson({ sessionId: "session-1", outcome: "Typed", runId: "" }), { name: "JsonException", path: "$.runId" });
    Expect.throwsMatching(() => TerminalRunResult.fromJson({ sessionId: "session-1", outcome: "Typed", runId: "run-1", endedRuns: [], command: "ls" }), { name: "JsonException", path: "$.command" });
  }
}
