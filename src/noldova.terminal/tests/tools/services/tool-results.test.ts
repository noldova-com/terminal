/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ToolContentKind, type ToolResult } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { ToolResults } from "../../../src/tools/services/tool-results.ts";

describe("ToolResults", () => {
  it("holds the text as its one text content, from its origin, with the structured result", () => {
    const result: ToolResult = ToolResults.create("Terminal t1 is open.", { terminalId: "t1" }, "terminal:t1");

    assert.deepEqual(result.content.map(t => [t.kind, t.value, t.origin]), [[ToolContentKind.Text, "Terminal t1 is open.", "terminal:t1"]]);
    assert.deepEqual(result.structured, { terminalId: "t1" });
  });

  it("holds text with no origin", () => {
    const result: ToolResult = ToolResults.create("No terminals are open.", {}, null);

    assert.deepEqual(result.content.map(t => [t.value, t.origin]), [["No terminals are open.", null]]);
  });
});
