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

import { TerminalVisibilityParams } from "../../src/models/terminal-visibility-params.ts";

describe("TerminalVisibilityParams", () => {
  it("writes and reads its wire form", () => {
    assert.equal(TerminalVisibilityParams.fromJson({ sessionId: "s1", paneId: "p1", visible: false }).isVisible, false);
    assert.deepEqual(new TerminalVisibilityParams("s1", "p1", true).toJson(), { sessionId: "s1", paneId: "p1", visible: true });
  });

  it("refuses a blank pane id", () => {
    assert.throws(() => new TerminalVisibilityParams("s1", "", true), ArgumentException);
    assert.throws(() => TerminalVisibilityParams.fromJson({ sessionId: "s1", paneId: "p1", visible: 1 }), { name: "JsonException", path: "$.visible" });
  });

  it("refuses a blank session", () => {
    for (const id of ["", " "])
      assert.throws(() => new TerminalVisibilityParams(id, "p1", true), { name: "ArgumentException", parameterName: "sessionId" });
  });
});
