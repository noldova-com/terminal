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

import { TerminalResizeParams } from "../../src/models/terminal-resize-params.ts";
import { TerminalSize } from "../../src/models/terminal-size.ts";

describe("TerminalResizeParams", () => {
  it("writes and reads its wire form", () => {
    const params: TerminalResizeParams = TerminalResizeParams.fromJson({ sessionId: "s1", size: { cols: 132, rows: 50 } });

    assert.equal(params.size.columns, 132);
    assert.deepEqual(new TerminalResizeParams("s1", new TerminalSize(80, 24)).toJson(), { sessionId: "s1", size: { cols: 80, rows: 24 } });
  });

  it("refuses a blank session id", () => {
    assert.throws(() => new TerminalResizeParams("", new TerminalSize(80, 24)), ArgumentException);
    assert.throws(() => TerminalResizeParams.fromJson({ sessionId: "s1", size: null }), { name: "JsonException", path: "$.size" });
  });
});
