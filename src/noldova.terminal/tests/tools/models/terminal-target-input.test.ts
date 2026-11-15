/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ArgumentException } from "@noldova/context.exceptions";
import { describe, it } from "vitest";

import { TerminalTargetInput } from "../../../src/tools/models/terminal-target-input.ts";

describe("TerminalTargetInput", () => {
  it("reads the terminal and the explanation", () => {
    const input: TerminalTargetInput = TerminalTargetInput.fromJson({ terminal_id: "t1", explanation: "It hangs." });

    assert.equal(input.terminalId, "t1");
    assert.equal(input.explanation, "It hangs.");
    assert.equal(TerminalTargetInput.fromJson({ terminal_id: "t1" }).explanation, null);
  });

  it("refuses a missing terminal, unknown fields and a long explanation", () => {
    assert.throws(() => TerminalTargetInput.fromJson({}), { name: "JsonException", path: "$.terminal_id" });
    assert.throws(() => TerminalTargetInput.fromJson({ terminal_id: "t1", force: true }), { name: "JsonException", path: "$.force" });
    assert.throws(() => new TerminalTargetInput("t1", "x".repeat(2_001)), ArgumentException);
    assert.throws(() => new TerminalTargetInput(" ", null), ArgumentException);
  });
});
