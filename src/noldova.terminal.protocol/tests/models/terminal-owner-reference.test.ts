/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalOwnerReference } from "../../src/models/terminal-owner-reference.ts";

describe("TerminalOwnerReference", () => {
  it("writes and reads its wire form", () => {
    assert.equal(TerminalOwnerReference.fromJson({ owner: "example.chat/42" }).owner, "example.chat/42");
    assert.deepEqual(new TerminalOwnerReference("example.chat/7").toJson(), { owner: "example.chat/7" });
  });

  it("refuses a blank or over-long owner, and another field", () => {
    for (const owner of ["", " ", "o".repeat(257)])
      assert.throws(() => new TerminalOwnerReference(owner), { name: "ArgumentException", parameterName: "owner" });
    assert.throws(() => TerminalOwnerReference.fromJson({ owner: 42 }), { name: "JsonException", path: "$.owner" });
    assert.throws(() => TerminalOwnerReference.fromJson({ owner: "a", sessionId: "s1" }), { name: "JsonException", path: "$.sessionId" });
  });
});
