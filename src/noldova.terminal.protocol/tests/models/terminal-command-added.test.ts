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

import { TerminalCommandAdded } from "../../src/models/terminal-command-added.ts";

describe("TerminalCommandAdded", () => {
  it("writes and reads its wire form", () => {
    const json: object = { sessionId: "s1", command: "git commit -m \"x\"" };

    assert.equal(TerminalCommandAdded.fromJson(json).command, "git commit -m \"x\"");
    assert.deepEqual(new TerminalCommandAdded("s1", "git commit -m \"x\"").toJson(), json);
  });

  it("refuses a blank or too long command", () => {
    assert.equal(new TerminalCommandAdded("s1", "c".repeat(4_096)).command.length, 4_096);
    assert.throws(() => new TerminalCommandAdded("s1", " "), ArgumentException);
    assert.throws(() => new TerminalCommandAdded("s1", "c".repeat(4_097)), ArgumentException);
    assert.throws(() => TerminalCommandAdded.fromJson({ sessionId: "s1", command: "" }), { name: "JsonException", path: "$.command" });
    assert.throws(() => TerminalCommandAdded.fromJson({ sessionId: "s1", command: "ls", cwd: "/" }), { name: "JsonException", path: "$.cwd" });
  });

  it("refuses a blank session", () => {
    for (const id of ["", " "])
      assert.throws(() => new TerminalCommandAdded(id, "ls"), { name: "ArgumentException", parameterName: "sessionId" });
  });
});
