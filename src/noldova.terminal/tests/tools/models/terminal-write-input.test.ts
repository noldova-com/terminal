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

import { KeySequence } from "../../../src/tools/models/key-sequence.ts";
import { TerminalWriteInput } from "../../../src/tools/models/terminal-write-input.ts";

describe("TerminalWriteInput", () => {
  it("reads every field", () => {
    const input: TerminalWriteInput = TerminalWriteInput.fromJson({ terminal_id: "t1", keys: "y\r", explanation: "Confirms." });

    assert.equal(input.terminalId, "t1");
    assert.equal(input.keys.text, "y\r");
    assert.equal(input.explanation, "Confirms.");
  });

  it("takes no explanation when absent", () => {
    assert.equal(TerminalWriteInput.fromJson({ terminal_id: "t1", keys: "q" }).explanation, null);
  });

  it("refuses missing keys, unknown fields and a long explanation", () => {
    assert.throws(() => TerminalWriteInput.fromJson({ terminal_id: "t1" }), { name: "JsonException", path: "$.keys" });
    assert.throws(() => TerminalWriteInput.fromJson({ terminal_id: "t1", keys: "q", enter: true }), { name: "JsonException", path: "$.enter" });
    assert.throws(() => TerminalWriteInput.fromJson({ terminal_id: "t1", keys: "" }), ArgumentException);
    assert.throws(() => new TerminalWriteInput("t1", new KeySequence("q"), "x".repeat(2_001)), ArgumentException);
    assert.throws(() => new TerminalWriteInput("", new KeySequence("q"), null), ArgumentException);
  });
});
