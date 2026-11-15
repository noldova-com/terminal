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

import { TerminalAckParams } from "../../src/models/terminal-ack-params.ts";

describe("TerminalAckParams", () => {
  it("writes and reads its wire form", () => {
    const params: TerminalAckParams = TerminalAckParams.fromJson({ sessionId: "s1", paneId: "p1", offset: 65_536 });

    assert.equal(params.offset, 65_536);
    assert.deepEqual(new TerminalAckParams("s1", "p1", 0).toJson(), { sessionId: "s1", paneId: "p1", offset: 0 });
  });

  it("refuses a negative offset", () => {
    assert.throws(() => new TerminalAckParams("s1", "p1", -1), ArgumentException);
    assert.throws(() => TerminalAckParams.fromJson({ sessionId: "s1", paneId: "p1", offset: -1 }), { name: "JsonException", path: "$.offset" });
  });

  it("refuses a blank session or pane", () => {
    for (const id of ["", " "])
      assert.throws(() => new TerminalAckParams(id, "p1", 0), { name: "ArgumentException", parameterName: "sessionId" });
    for (const id of ["", " "])
      assert.throws(() => new TerminalAckParams("s1", id, 0), { name: "ArgumentException", parameterName: "paneId" });
  });
});
