/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ToolAbortReason } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { AbortReasonUnknownException } from "../../../src/tools/exceptions/abort-reason-unknown.exception.ts";
import { AbortReasonReader } from "../../../src/tools/services/abort-reason-reader.ts";

describe("AbortReasonReader", () => {
  for (const reason of Object.values(ToolAbortReason)) {
    it(`reads the reason ${reason} Noldova Desktop aborted the call with`, () => {
      assert.equal(AbortReasonReader.readReason(AbortSignal.abort(reason)), reason);
    });
  }

  for (const [description, reason] of [
    ["no reason", undefined],
    ["null", null],
    ["an object", { kind: "Stopped" }],
    ["an unknown reason", "Paused"]
  ] as const) {
    it(`refuses ${description}, which Noldova Desktop never aborts a call with`, () => {
      const signal: AbortSignal = AbortSignal.abort(reason);

      assert.throws(() => AbortReasonReader.readReason(signal), (error: unknown) => error instanceof AbortReasonUnknownException && error.reason === signal.reason);
    });
  }

  it("interrupts the command when the person stopped the call, it was cancelled or its session ended, but not at a deadline or a switch-off", () => {
    assert.deepEqual(
      Object.values(ToolAbortReason).filter(t => AbortReasonReader.interruptsCommand(AbortSignal.abort(t))),
      [ToolAbortReason.Stopped, ToolAbortReason.Cancelled, ToolAbortReason.SessionEnded]);
  });
});
