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

import { TerminalName } from "../../src/models/terminal-name.ts";

describe("TerminalName", () => {
  it("writes and reads a name and its clearing", () => {
    assert.deepEqual(TerminalName.fromJson({ sessionId: "s1", name: "Server" }).toJson(), { sessionId: "s1", name: "Server" });
    assert.equal(TerminalName.fromJson({ sessionId: "s1", name: null }).name, null);
    assert.deepEqual(new TerminalName("s1", null).toJson(), { sessionId: "s1", name: null });
  });

  it("refuses a blank or too long name, a missing one and an unknown field", () => {
    assert.throws(() => new TerminalName("s1", " "), ArgumentException);
    assert.throws(() => new TerminalName("s1", "n".repeat(4097)), ArgumentException);
    assert.throws(() => TerminalName.fromJson({ sessionId: "s1", name: " " }), { name: "JsonException", path: "$.name" });
    assert.throws(() => TerminalName.fromJson({ sessionId: "s1", name: "n".repeat(4097) }), { name: "JsonException", path: "$.name" });
    assert.throws(() => TerminalName.fromJson({ sessionId: "s1" }), { name: "JsonException", path: "$.name" });
    assert.throws(() => TerminalName.fromJson({ sessionId: "s1", name: null, title: "x" }), { name: "JsonException", path: "$.title" });
  });
});
