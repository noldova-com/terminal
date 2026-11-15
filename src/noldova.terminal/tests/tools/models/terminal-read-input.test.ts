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

import { TerminalReadInput } from "../../../src/tools/models/terminal-read-input.ts";

describe("TerminalReadInput", () => {
  it("reads every field", () => {
    const input: TerminalReadInput = TerminalReadInput.fromJson({ terminal_id: "t1", wait_ms: 1_000, max_chars: 200 });

    assert.equal(input.terminalId, "t1");
    assert.equal(input.waitMilliseconds, 1_000);
    assert.equal(input.maximumCharacters, 200);
  });

  it("returns at once and up to 30000 characters by default", () => {
    const input: TerminalReadInput = TerminalReadInput.fromJson({ terminal_id: "t1" });

    assert.equal(input.waitMilliseconds, 0);
    assert.equal(input.maximumCharacters, 30_000);
  });

  it("clamps the wait to 30 s and the output to 30000 characters", () => {
    const input: TerminalReadInput = TerminalReadInput.fromJson({ terminal_id: "t1", wait_ms: 60_000, max_chars: 40_000 });

    assert.equal(input.waitMilliseconds, 30_000);
    assert.equal(input.maximumCharacters, 30_000);
  });

  it("refuses a missing terminal, unknown fields and values out of range", () => {
    assert.throws(() => TerminalReadInput.fromJson({}), { name: "JsonException", path: "$.terminal_id" });
    assert.throws(() => TerminalReadInput.fromJson({ terminal_id: "t1", offset: 0 }), { name: "JsonException", path: "$.offset" });
    assert.throws(() => new TerminalReadInput("t1", 30_001, 1), ArgumentException);
    assert.throws(() => new TerminalReadInput("t1", 0, 0), ArgumentException);
  });
});
