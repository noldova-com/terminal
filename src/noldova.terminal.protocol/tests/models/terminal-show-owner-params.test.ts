/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalShowOwnerParams } from "../../src/models/terminal-show-owner-params.ts";

describe("TerminalShowOwnerParams", () => {
  it("writes and reads its wire form, with an owner or none, shown or hidden, and as shown without isHidden", () => {
    assert.equal(TerminalShowOwnerParams.fromJson({ owner: "example.chat/42" }).owner, "example.chat/42");
    assert.equal(TerminalShowOwnerParams.fromJson({ owner: null }).owner, null);
    assert.deepEqual([TerminalShowOwnerParams.fromJson({ owner: null }).isHidden, TerminalShowOwnerParams.fromJson({ owner: null, isHidden: true }).isHidden],
      [false, true]);
    assert.deepEqual(new TerminalShowOwnerParams("example.chat/7").toJson(), { owner: "example.chat/7", isHidden: false });
    assert.deepEqual(new TerminalShowOwnerParams(null, true).toJson(), { owner: null, isHidden: true });
  });

  it("refuses a blank or over-long owner, a missing one, and another field", () => {
    for (const owner of ["", " ", "o".repeat(257)])
      assert.throws(() => new TerminalShowOwnerParams(owner), { name: "ArgumentException", parameterName: "owner" });
    assert.throws(() => TerminalShowOwnerParams.fromJson({ owner: 42 }), { name: "JsonException", path: "$.owner" });
    assert.throws(() => TerminalShowOwnerParams.fromJson({}), { name: "JsonException", path: "$.owner" });
    assert.throws(() => TerminalShowOwnerParams.fromJson({ owner: null, isHidden: "yes" }), { name: "JsonException", path: "$.isHidden" });
    assert.throws(() => TerminalShowOwnerParams.fromJson({ owner: "a", sessionId: "s1" }), { name: "JsonException", path: "$.sessionId" });
  });
});
