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

import { TerminalTitle } from "../../src/models/terminal-title.ts";

describe("TerminalTitle", () => {
  it("writes and reads its wire form", () => {
    assert.equal(TerminalTitle.fromJson({ sessionId: "s1", title: "vim notes.txt" }).title, "vim notes.txt");
    assert.deepEqual(new TerminalTitle("s1", "").toJson(), { sessionId: "s1", title: "" });
  });

  it("refuses a title longer than 4096 characters", () => {
    assert.throws(() => new TerminalTitle("s1", "t".repeat(4097)), ArgumentException);
    assert.throws(() => TerminalTitle.fromJson({ sessionId: "s1", title: "t".repeat(4097) }), { name: "JsonException", path: "$.title" });
  });

  it("refuses a blank session", () => {
    for (const id of ["", " "])
      assert.throws(() => new TerminalTitle(id, "bash"), { name: "ArgumentException", parameterName: "sessionId" });
  });
});
