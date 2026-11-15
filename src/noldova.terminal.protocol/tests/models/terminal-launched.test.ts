/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalLaunched } from "../../src/models/terminal-launched.ts";

describe("TerminalLaunched", () => {
  it("writes and reads a launched terminal and a missing folder", () => {
    for (const json of [{ sessionId: "session-1", missingFolder: null }, { sessionId: null, missingFolder: "/gone" }])
      assert.deepEqual(TerminalLaunched.fromJson(json).toJson(), json);
    assert.equal(new TerminalLaunched("session-1", null).sessionId, "session-1");
    assert.equal(new TerminalLaunched(null, "C:\\gone").missingFolder, "C:\\gone");
  });

  it("refuses both or neither", () => {
    for (const [sessionId, missingFolder] of [["session-1", "/gone"], [null, null]] as const)
      assert.throws(() => new TerminalLaunched(sessionId, missingFolder),
        { name: "ArgumentException", parameterName: "sessionId", message: "The value must give either sessionId or missingFolder, not both or neither. (Parameter 'sessionId')" });
  });

  it("refuses a blank session or a relative folder, and a missing or unknown field", () => {
    assert.throws(() => new TerminalLaunched(" ", null), { name: "ArgumentException", parameterName: "sessionId" });
    assert.throws(() => new TerminalLaunched(null, "gone"), { name: "ArgumentException", parameterName: "missingFolder" });
    assert.throws(() => TerminalLaunched.fromJson({ sessionId: "session-1" }), { name: "JsonException", path: "$.missingFolder" });
    assert.throws(() => TerminalLaunched.fromJson({ sessionId: null, missingFolder: "gone" }), { name: "JsonException", path: "$.missingFolder" });
    assert.throws(() => TerminalLaunched.fromJson({ sessionId: null, missingFolder: null }), { name: "JsonException", path: "$.sessionId" });
    assert.throws(() => TerminalLaunched.fromJson({ sessionId: "session-1", missingFolder: null, owner: null }), { name: "JsonException", path: "$.owner" });
  });
});
