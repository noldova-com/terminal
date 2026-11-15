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

import { TerminalReference } from "../../src/models/terminal-reference.ts";

describe("TerminalReference", () => {
  it("writes and reads its wire form", () => {
    assert.equal(TerminalReference.fromJson({ sessionId: "s1" }).sessionId, "s1");
    assert.deepEqual(new TerminalReference("s2").toJson(), { sessionId: "s2" });
  });

  it("refuses a blank session id", () => {
    assert.throws(() => new TerminalReference(""), ArgumentException);
    assert.throws(() => TerminalReference.fromJson({ sessionId: 1 }), { name: "JsonException", path: "$.sessionId" });
  });
});
