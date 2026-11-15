/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalCompleteParams } from "../../src/models/terminal-complete-params.ts";

describe("TerminalCompleteParams", () => {
  it("writes and reads its wire form", () => {
    const json: object = { sessionId: "s1", line: "git checkout ma", cursor: 15, asksShell: true };
    const params: TerminalCompleteParams = TerminalCompleteParams.fromJson(json);

    assert.deepEqual([params.sessionId, params.line, params.cursor, params.asksShell], ["s1", "git checkout ma", 15, true]);
    assert.deepEqual(params.toJson(), json);
  });

  it("asks only the runtime when asksShell is left out", () => {
    assert.equal(TerminalCompleteParams.fromJson({ sessionId: "s1", line: "ls", cursor: 2 }).asksShell, false);
    assert.equal(new TerminalCompleteParams("s1", "ls", 2).asksShell, false);
  });

  it("takes an empty line, and a line of 4,096 code units with the cursor at either end", () => {
    assert.equal(new TerminalCompleteParams("s1", "", 0).cursor, 0);
    assert.equal(new TerminalCompleteParams("s1", "x".repeat(4_096), 4_096).cursor, 4_096);
    assert.equal(new TerminalCompleteParams("s1", "x".repeat(4_096), 0).cursor, 0);
  });

  it("refuses a blank session, a longer line, and a cursor outside the line or between code units", () => {
    assert.throws(() => new TerminalCompleteParams(" ", "ls", 2), { name: "ArgumentException", parameterName: "sessionId" });
    assert.throws(() => new TerminalCompleteParams("s1", "x".repeat(4_097), 0), { name: "ArgumentException", parameterName: "line" });
    for (const cursor of [-1, 3, 1.5])
      assert.throws(() => new TerminalCompleteParams("s1", "ls", cursor), { name: "ArgumentOutOfRangeException", parameterName: "cursor" });
  });

  it("names the field it cannot read", () => {
    assert.throws(() => TerminalCompleteParams.fromJson({ sessionId: "s1", line: "ls", cursor: 3 }), { name: "JsonException", path: "$.cursor" });
    assert.throws(() => TerminalCompleteParams.fromJson({ sessionId: "s1", line: 7, cursor: 0 }), { name: "JsonException", path: "$.line" });
    assert.throws(() => TerminalCompleteParams.fromJson({ sessionId: "s1", line: "ls", cursor: 0, shell: "bash" }), { name: "JsonException" });
    assert.throws(() => TerminalCompleteParams.fromJson({ sessionId: "s1", line: "ls", cursor: 0, asksShell: "yes" }),
      { name: "JsonException", path: "$.asksShell" });
  });
});
