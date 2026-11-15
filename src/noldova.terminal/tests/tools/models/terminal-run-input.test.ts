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

import { CommandLine } from "../../../src/tools/models/command-line.ts";
import { TerminalRunInput } from "../../../src/tools/models/terminal-run-input.ts";

describe("TerminalRunInput", () => {
  it("reads every field", () => {
    const input: TerminalRunInput = TerminalRunInput.fromJson({
      terminal_id: "t1", command: "npm test", explanation: "Runs the tests.", yield_ms: 2_000, timeout_ms: 60_000, max_chars: 500
    });

    assert.equal(input.terminalId, "t1");
    assert.equal(input.command.text, "npm test");
    assert.equal(input.explanation, "Runs the tests.");
    assert.equal(input.yieldMilliseconds, 2_000);
    assert.equal(input.timeoutMilliseconds, 60_000);
    assert.equal(input.maximumCharacters, 500);
  });

  it("takes the defaults for absent fields", () => {
    const input: TerminalRunInput = TerminalRunInput.fromJson({ terminal_id: "t1", command: "ls" });

    assert.equal(input.explanation, null);
    assert.equal(input.yieldMilliseconds, 10_000);
    assert.equal(input.timeoutMilliseconds, 0);
    assert.equal(input.maximumCharacters, 30_000);
  });

  it("clamps the yield to 250 ms to 30 s and the output to 30000 characters", () => {
    assert.equal(TerminalRunInput.fromJson({ terminal_id: "t1", command: "ls", yield_ms: 0 }).yieldMilliseconds, 250);
    assert.equal(TerminalRunInput.fromJson({ terminal_id: "t1", command: "ls", yield_ms: 90_000 }).yieldMilliseconds, 30_000);
    assert.equal(TerminalRunInput.fromJson({ terminal_id: "t1", command: "ls", max_chars: 90_000 }).maximumCharacters, 30_000);
  });

  it("refuses unknown fields, a missing command and negative numbers", () => {
    assert.throws(() => TerminalRunInput.fromJson({ terminal_id: "t1", command: "ls", shell: "bash" }), { name: "JsonException", path: "$.shell" });
    assert.throws(() => TerminalRunInput.fromJson({ terminal_id: "t1" }), { name: "JsonException", path: "$.command" });
    assert.throws(() => TerminalRunInput.fromJson({ terminal_id: "t1", command: "ls", timeout_ms: -1 }), { name: "JsonException", path: "$.timeout_ms" });
    assert.throws(() => TerminalRunInput.fromJson({ terminal_id: "t1", command: "ls", max_chars: 0 }), { name: "JsonException", path: "$.max_chars" });
  });

  it("refuses a command with a newline", () => {
    assert.throws(() => TerminalRunInput.fromJson({ terminal_id: "t1", command: "ls\nrm x" }), ArgumentException);
  });

  it("refuses values out of range in its constructor", () => {
    const command: CommandLine = new CommandLine("ls");

    assert.throws(() => new TerminalRunInput(" ", command, null, 250, 0, 1), ArgumentException);
    assert.throws(() => new TerminalRunInput("t1", command, "x".repeat(2_001), 250, 0, 1), ArgumentException);
    assert.throws(() => new TerminalRunInput("t1", command, null, 249, 0, 1), ArgumentException);
    assert.throws(() => new TerminalRunInput("t1", command, null, 250, -1, 1), ArgumentException);
    assert.throws(() => new TerminalRunInput("t1", command, null, 250, 0, 30_001), ArgumentException);
  });
});
