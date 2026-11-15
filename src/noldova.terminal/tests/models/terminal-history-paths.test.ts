/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalHistoryPaths } from "../../src/models/terminal-history-paths.ts";

describe("TerminalHistoryPaths", () => {
  it("keeps the files of a terminal's first and second segments", () => {
    const paths: TerminalHistoryPaths = new TerminalHistoryPaths("/tmp/lines/s1-1.jsonl", "/tmp/lines/s1-2.jsonl");

    assert.deepEqual([paths.first, paths.second], ["/tmp/lines/s1-1.jsonl", "/tmp/lines/s1-2.jsonl"]);
  });
});
