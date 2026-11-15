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

import { TerminalCommandEnded } from "../../src/models/terminal-command-ended.ts";

describe("TerminalCommandEnded", () => {
  it("writes and reads its wire form, with or without an exit code", () => {
    const json: object = { sessionId: "s1", exitCode: 1 };
    const unknown: object = { sessionId: "s1", exitCode: null };

    assert.deepEqual([TerminalCommandEnded.fromJson(json).exitCode, TerminalCommandEnded.fromJson(unknown).exitCode], [1, null]);
    assert.deepEqual([new TerminalCommandEnded("s1", 1).toJson(), new TerminalCommandEnded("s1", null).toJson()], [json, unknown]);
  });

  it("refuses a blank session, an exit code out of range, a missing exit code and another field", () => {
    assert.throws(() => new TerminalCommandEnded(" ", 0), ArgumentException);
    assert.throws(() => new TerminalCommandEnded("s1", 4_294_967_296), ArgumentException);
    assert.throws(() => new TerminalCommandEnded("s1", 1.5), ArgumentException);
    assert.throws(() => TerminalCommandEnded.fromJson({ sessionId: "s1" }), { name: "JsonException", path: "$.exitCode" });
    assert.throws(() => TerminalCommandEnded.fromJson({ sessionId: "s1", exitCode: 0, endedBy: "Exit" }), { name: "JsonException" });
  });
});
