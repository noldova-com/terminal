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
import { TerminalRunEnded } from "../../src/models/terminal-run-ended.ts";

describe("TerminalRunEnded", () => {
  it("writes and reads each way a run ends, with the last command's code only when its shell marked it", () => {
    const json: object = { sessionId: "s1", runId: "r1", endedBy: "Command", exitCode: 3 };

    assert.deepEqual(TerminalRunEnded.fromJson(json).toJson(), json);
    for (const endedBy of Object.values(TerminalRunEndedBy))
      assert.deepEqual(new TerminalRunEnded("s1", "r1", endedBy, null).toJson(), { sessionId: "s1", runId: "r1", endedBy, exitCode: null });
  });

  it("refuses a code for an end the shell didn't mark, a code out of range, a blank id, an unknown end and another field", () => {
    for (const endedBy of [TerminalRunEndedBy.NoIntegration, TerminalRunEndedBy.TerminalEnded])
      assert.throws(() => new TerminalRunEnded("s1", "r1", endedBy, 0), { name: "ArgumentException", parameterName: "exitCode",
        message: "The value must give an exitCode only when endedBy is Command. (Parameter 'exitCode')" });
    assert.throws(() => new TerminalRunEnded("s1", "r1", TerminalRunEndedBy.Command, 4_294_967_296), { name: "ArgumentOutOfRangeException", parameterName: "exitCode" });
    assert.throws(() => new TerminalRunEnded("s1", " ", TerminalRunEndedBy.Command, 0), { name: "ArgumentException", parameterName: "runId" });
    assert.throws(() => new TerminalRunEnded(" ", "r1", TerminalRunEndedBy.Command, 0), { name: "ArgumentException", parameterName: "sessionId" });
    assert.throws(() => TerminalRunEnded.fromJson({ sessionId: "s1", runId: "r1", endedBy: "Exit", exitCode: null }), { name: "JsonException", path: "$.endedBy" });
    assert.throws(() => TerminalRunEnded.fromJson({ sessionId: "s1", runId: "r1", endedBy: "Command" }), { name: "JsonException", path: "$.exitCode" });
    assert.throws(() => TerminalRunEnded.fromJson({ sessionId: "s1", runId: "r1", endedBy: "NoIntegration", exitCode: 0 }), { name: "JsonException", path: "$.exitCode" });
    assert.throws(() => TerminalRunEnded.fromJson({ sessionId: "s1", runId: "r1", endedBy: "Command", exitCode: 0, at: 1 }), { name: "JsonException", path: "$.at" });
  });
});
