/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalLinesParams } from "../../src/models/terminal-lines-params.ts";

describe("TerminalLinesParams", () => {
  it("writes and reads its wire form", () => {
    const json: object = { sessionId: "s1", start: 1500, limit: 200 };
    const params: TerminalLinesParams = TerminalLinesParams.fromJson(json);

    assert.deepEqual([params.sessionId, params.start, params.limit], ["s1", 1500, 200]);
    assert.deepEqual(params.toJson(), json);
  });

  it("asks for one line to 500 lines, from line 0 on", () => {
    assert.deepEqual([new TerminalLinesParams("s1", 0, 1).start, new TerminalLinesParams("s1", 0, 500).limit], [0, 500]);
  });

  it("refuses a blank session, a negative or fractional start, and a limit outside one to 500", () => {
    assert.throws(() => new TerminalLinesParams(" ", 0, 10), { name: "ArgumentException", parameterName: "sessionId" });
    for (const start of [-1, 0.5])
      assert.throws(() => new TerminalLinesParams("s1", start, 10), { name: "ArgumentOutOfRangeException", parameterName: "start" });
    for (const limit of [0, 501, 2.5])
      assert.throws(() => new TerminalLinesParams("s1", 0, limit), { name: "ArgumentOutOfRangeException", parameterName: "limit" });
  });

  it("names the field it cannot read", () => {
    assert.throws(() => TerminalLinesParams.fromJson({ sessionId: "s1", start: 0, limit: "all" }), { name: "JsonException", path: "$.limit" });
  });
});
