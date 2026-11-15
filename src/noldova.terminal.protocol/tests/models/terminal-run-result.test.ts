/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalRunEndedBy } from "../../src/enums/terminal-run-ended-by.ts";
import { TerminalRunOutcome } from "../../src/enums/terminal-run-outcome.ts";
import { TerminalRunEnded } from "../../src/models/terminal-run-ended.ts";
import { TerminalRunResult } from "../../src/models/terminal-run-result.ts";

describe("TerminalRunResult", () => {
  it("writes and reads each outcome, with a run id exactly when the commands were typed", () => {
    assert.deepEqual(TerminalRunResult.fromJson({ sessionId: "session-1", outcome: "Typed", runId: "run-1", endedRuns: [] }).toJson(),
      { sessionId: "session-1", outcome: "Typed", runId: "run-1", endedRuns: [] });
    for (const outcome of [TerminalRunOutcome.Input, TerminalRunOutcome.Tab, TerminalRunOutcome.Ended, TerminalRunOutcome.Busy])
      assert.deepEqual(TerminalRunResult.fromJson({ sessionId: "session-1", outcome, runId: null, endedRuns: [] }).toJson(), { sessionId: "session-1", outcome, runId: null, endedRuns: [] });
    assert.equal(new TerminalRunResult("session-1", TerminalRunOutcome.Tab).outcome, "Tab");
    assert.equal(new TerminalRunResult("session-1", TerminalRunOutcome.Tab).runId, null);
    assert.equal(new TerminalRunResult("session-1", TerminalRunOutcome.Typed, "run-1").runId, "run-1");
  });

  it("writes and reads a run that found no shell of its kinds, which names no terminal", () => {
    assert.deepEqual(TerminalRunResult.fromJson({ sessionId: null, outcome: "NoShell", runId: null, endedRuns: [] }).toJson(), { sessionId: null, outcome: "NoShell", runId: null, endedRuns: [] });
    assert.equal(new TerminalRunResult(null, TerminalRunOutcome.NoShell).sessionId, null);
  });

  it("refuses no terminal with another outcome, and a terminal with NoShell", () => {
    for (const outcome of [TerminalRunOutcome.Typed, TerminalRunOutcome.Input, TerminalRunOutcome.Tab, TerminalRunOutcome.Ended, TerminalRunOutcome.Busy])
      assert.throws(() => new TerminalRunResult(null, outcome, "run-1"), { name: "ArgumentException", parameterName: "sessionId",
        message: "The value must give a sessionId unless its outcome is NoShell, and none when it is. (Parameter 'sessionId')" });
    assert.throws(() => new TerminalRunResult("session-1", TerminalRunOutcome.NoShell), { name: "ArgumentException", parameterName: "sessionId" });
    assert.throws(() => TerminalRunResult.fromJson({ sessionId: null, outcome: "Typed", runId: "run-1", endedRuns: [] }), { name: "JsonException", path: "$.sessionId",
      message: "$.sessionId: The value must give a sessionId unless its outcome is NoShell, and none when it is. (Parameter 'sessionId')" });
  });

  it("refuses a typed run without a run id, and a run id with another outcome", () => {
    assert.throws(() => new TerminalRunResult("session-1", TerminalRunOutcome.Typed), { name: "ArgumentException", parameterName: "runId",
      message: "The value must give a runId when its outcome is Typed, and none when it isn't. (Parameter 'runId')" });
    for (const outcome of [TerminalRunOutcome.Input, TerminalRunOutcome.Tab, TerminalRunOutcome.Ended, TerminalRunOutcome.Busy])
      assert.throws(() => new TerminalRunResult("session-1", outcome, "run-1"), { name: "ArgumentException", parameterName: "runId" });
    assert.throws(() => new TerminalRunResult(null, TerminalRunOutcome.NoShell, "run-1"), { name: "ArgumentException", parameterName: "runId" });
    assert.throws(() => TerminalRunResult.fromJson({ sessionId: "session-1", outcome: "Typed", runId: null, endedRuns: [] }), { name: "JsonException", path: "$.runId" });
  });

  it("writes and reads the ends the runtime knew as it typed the run, and refuses them for a run it didn't type", () => {
    const ended: object = { sessionId: "session-1", runId: "run-0", endedBy: "Command", exitCode: null };
    const own: object = { sessionId: "session-1", runId: "run-1", endedBy: "NoIntegration", exitCode: null };
    const json: object = { sessionId: "session-1", outcome: "Typed", runId: "run-1", endedRuns: [ended, own] };

    assert.deepEqual(TerminalRunResult.fromJson(json).toJson(), json);
    assert.deepEqual(TerminalRunResult.fromJson(json).endedRuns.map(t => t.endedBy), ["Command", "NoIntegration"]);
    assert.deepEqual(new TerminalRunResult("session-1", TerminalRunOutcome.Typed, "run-1").endedRuns, []);
    assert.throws(() => new TerminalRunResult("session-1", TerminalRunOutcome.Busy, null,
      [new TerminalRunEnded("session-1", "run-0", TerminalRunEndedBy.TerminalEnded, null)]), { name: "ArgumentException", parameterName: "endedRuns",
      message: "The value must give endedRuns only when its outcome is Typed. (Parameter 'endedRuns')" });
    assert.throws(() => TerminalRunResult.fromJson({ sessionId: "session-1", outcome: "Typed", runId: "run-1" }), { name: "JsonException", path: "$.endedRuns" });
    assert.throws(() => TerminalRunResult.fromJson({ ...json, endedRuns: [{ ...ended, endedBy: "Exit" }] }), { name: "JsonException", path: "$.endedRuns.0.endedBy" });
    assert.throws(() => TerminalRunResult.fromJson({ ...json, outcome: "Busy", runId: null }), { name: "JsonException", path: "$.endedRuns" });
    assert.throws(() => TerminalRunResult.fromJson({ ...json, endedRuns: [ended, { ...own, endedBy: "TerminalEnded", exitCode: 1 }] }),
      { name: "JsonException", path: "$.endedRuns.1.exitCode" });
  });

  it("refuses a blank session or run, an unknown outcome, and a missing or unknown field", () => {
    assert.throws(() => new TerminalRunResult(" ", TerminalRunOutcome.Typed, "run-1"), { name: "ArgumentException", parameterName: "sessionId" });
    assert.throws(() => new TerminalRunResult("session-1", TerminalRunOutcome.Typed, " "), { name: "ArgumentException", parameterName: "runId" });
    assert.throws(() => TerminalRunResult.fromJson({ sessionId: "session-1", outcome: "Ran", runId: null, endedRuns: [] }), { name: "JsonException", path: "$.outcome" });
    assert.throws(() => TerminalRunResult.fromJson({ sessionId: "session-1", runId: null, endedRuns: [] }), { name: "JsonException", path: "$.outcome" });
    assert.throws(() => TerminalRunResult.fromJson({ sessionId: "session-1", outcome: "Typed", endedRuns: [] }), { name: "JsonException", path: "$.runId" });
    assert.throws(() => TerminalRunResult.fromJson({ sessionId: "session-1", outcome: "Typed", runId: "" }), { name: "JsonException", path: "$.runId" });
    assert.throws(() => TerminalRunResult.fromJson({ sessionId: "session-1", outcome: "Typed", runId: "run-1", endedRuns: [], command: "ls" }),
      { name: "JsonException", path: "$.command" });
  });
});
