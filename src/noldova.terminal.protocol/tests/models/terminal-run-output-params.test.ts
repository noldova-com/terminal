/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalRunOutputParams } from "../../src/models/terminal-run-output-params.ts";

describe("TerminalRunOutputParams", () => {
  it("writes and reads its wire form", () => {
    const json: object = { sessionId: "session-1", runId: "run-1", maximumLines: 2000 };
    const params: TerminalRunOutputParams = TerminalRunOutputParams.fromJson(json);

    assert.deepEqual([params.sessionId, params.runId, params.maximumLines], ["session-1", "run-1", 2000]);
    assert.deepEqual(params.toJson(), json);
  });

  it("takes from 1 to 5000 lines", () => {
    for (const maximumLines of [1, 5000])
      assert.equal(new TerminalRunOutputParams("session-1", "run-1", maximumLines).maximumLines, maximumLines);
  });

  it("refuses a blank terminal or run, and a number of lines out of range or not whole", () => {
    assert.throws(() => new TerminalRunOutputParams(" ", "run-1", 1), { name: "ArgumentException", parameterName: "sessionId" });
    assert.throws(() => new TerminalRunOutputParams("session-1", "", 1), { name: "ArgumentException", parameterName: "runId" });
    for (const maximumLines of [0, 5001, 1.5])
      assert.throws(() => new TerminalRunOutputParams("session-1", "run-1", maximumLines), { name: "ArgumentOutOfRangeException", parameterName: "maximumLines",
        message: "The value must be a whole number from 1 to 5000. (Parameter 'maximumLines')" });
  });

  it("refuses a missing or unknown field, and a number of lines out of range", () => {
    const json: Record<string, unknown> = { sessionId: "session-1", runId: "run-1", maximumLines: 10 };

    assert.throws(() => TerminalRunOutputParams.fromJson({ ...json, runId: undefined }), { name: "JsonException", path: "$.runId" });
    assert.throws(() => TerminalRunOutputParams.fromJson({ ...json, sessionId: "" }), { name: "JsonException", path: "$.sessionId" });
    assert.throws(() => TerminalRunOutputParams.fromJson({ ...json, maximumLines: 0 }), { name: "JsonException", path: "$.maximumLines" });
    assert.throws(() => TerminalRunOutputParams.fromJson({ ...json, maximumLines: 5001 }), { name: "JsonException", path: "$.maximumLines" });
    assert.throws(() => TerminalRunOutputParams.fromJson({ ...json, offset: 0 }), { name: "JsonException", path: "$.offset" });
  });
});
