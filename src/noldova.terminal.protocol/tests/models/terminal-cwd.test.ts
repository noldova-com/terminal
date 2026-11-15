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

import { TerminalCwd } from "../../src/models/terminal-cwd.ts";

describe("TerminalCwd", () => {
  it("writes and reads its wire form", () => {
    assert.equal(TerminalCwd.fromJson({ sessionId: "s1", cwd: "/home/me/src" }).cwd, "/home/me/src");
    assert.deepEqual(new TerminalCwd("s1", "C:\\src").toJson(), { sessionId: "s1", cwd: "C:\\src" });
  });

  it("refuses a blank folder or one longer than 4096 characters", () => {
    assert.throws(() => new TerminalCwd("s1", " "), ArgumentException);
    assert.throws(() => new TerminalCwd("s1", "/".repeat(4097)), ArgumentException);
    assert.throws(() => TerminalCwd.fromJson({ sessionId: "s1", cwd: "" }), { name: "JsonException", path: "$.cwd" });
  });

  it("refuses a blank session", () => {
    for (const id of ["", " "])
      assert.throws(() => new TerminalCwd(id, "/work"), { name: "ArgumentException", parameterName: "sessionId" });
  });
});
