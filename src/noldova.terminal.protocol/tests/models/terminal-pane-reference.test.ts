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

import { TerminalPaneReference } from "../../src/models/terminal-pane-reference.ts";

describe("TerminalPaneReference", () => {
  it("writes and reads its wire form", () => {
    const reference: TerminalPaneReference = TerminalPaneReference.fromJson({ sessionId: "s1", paneId: "p1" });

    assert.equal(reference.sessionId, "s1");
    assert.equal(reference.paneId, "p1");
    assert.deepEqual(new TerminalPaneReference("s2", "p2").toJson(), { sessionId: "s2", paneId: "p2" });
  });

  it("refuses a blank pane id", () => {
    assert.throws(() => new TerminalPaneReference("s1", " "), ArgumentException);
    assert.throws(() => TerminalPaneReference.fromJson({ sessionId: "s1" }), { name: "JsonException", path: "$.paneId" });
  });

  it("refuses a blank session", () => {
    for (const id of ["", " "])
      assert.throws(() => new TerminalPaneReference(id, "p1"), { name: "ArgumentException", parameterName: "sessionId" });
  });
});
