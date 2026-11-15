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

import { TerminalInputParams } from "../../src/models/terminal-input-params.ts";

describe("TerminalInputParams", () => {
  it("writes and reads its wire form, control characters included", () => {
    const params: TerminalInputParams = TerminalInputParams.fromJson({ sessionId: "s1", data: "ls\r\u0003" });

    assert.equal(params.data, "ls\r\u0003");
    assert.deepEqual(new TerminalInputParams("s1", "").toJson(), { sessionId: "s1", data: "" });
  });

  it("refuses more than 1 MiB of input", () => {
    const data: string = "a".repeat(1_048_577);

    assert.throws(() => new TerminalInputParams("s1", data), ArgumentException);
    assert.throws(() => TerminalInputParams.fromJson({ sessionId: "s1", data }), { name: "JsonException", path: "$.data" });
  });

  it("refuses a blank session", () => {
    for (const id of ["", " "])
      assert.throws(() => new TerminalInputParams(id, "ls"), { name: "ArgumentException", parameterName: "sessionId" });
  });
});
