/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ToolAbortReason, ToolFailureCode, type ToolFailureException, type ToolResult } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { ToolFailures } from "../../../src/tools/services/tool-failures.ts";
import { ToolResults } from "../../../src/tools/services/tool-results.ts";

describe("ToolFailures", () => {
  it("creates a failure with its code, module code and message, and no output", () => {
    const error: ToolFailureException = ToolFailures.create(ToolFailureCode.Unavailable, "terminal.ended", "Terminal t1 has ended.");

    assert.deepEqual([error.failure.code, error.failure.moduleCode, error.failure.message, error.failure.content],
      [ToolFailureCode.Unavailable, "terminal.ended", "Terminal t1 has ended.", []]);
  });

  it("creates a failure that carries the output read so far", () => {
    const output: ToolResult = ToolResults.create("built", {}, "terminal:t1");

    const error: ToolFailureException = ToolFailures.create(ToolFailureCode.TimedOut, null, "It timed out.", output);

    assert.equal(error.failure.moduleCode, null);
    assert.deepEqual(error.failure.content, output.content);
  });

  for (const [reason, code] of [
    [ToolAbortReason.Stopped, ToolFailureCode.Stopped],
    [ToolAbortReason.Cancelled, ToolFailureCode.Cancelled],
    [ToolAbortReason.SessionEnded, ToolFailureCode.Cancelled],
    [ToolAbortReason.SwitchedOff, ToolFailureCode.Unavailable],
    [ToolAbortReason.DeadlineReached, ToolFailureCode.TimedOut]
  ] as const) {
    it(`fails a call ended as ${reason} with ${code}, and no module code`, () => {
      const error: ToolFailureException = ToolFailures.forEndedCall(AbortSignal.abort(reason), "The call ended.");

      assert.deepEqual([error.failure.code, error.failure.moduleCode, error.failure.message], [code, null, "The call ended."]);
    });
  }

  it("fails a cancelled call with the output read so far", () => {
    const output: ToolResult = ToolResults.create("partial", {}, null);

    const error: ToolFailureException = ToolFailures.forEndedCall(AbortSignal.abort(ToolAbortReason.Cancelled), "The call ended.", output);

    assert.equal(error.failure.code, ToolFailureCode.Cancelled);
    assert.deepEqual(error.failure.content, output.content);
  });

  it("fails a call whose outcome is uncertain with the terminal's uncertain code", () => {
    const error: ToolFailureException = ToolFailures.forUncertainOutcome("The keys may have been sent.");

    assert.deepEqual([error.failure.code, error.failure.moduleCode, error.failure.message, error.failure.content],
      [ToolFailureCode.OutcomeUncertain, "terminal.outcomeUncertain", "The keys may have been sent.", []]);
  });
});
