/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TakenSegment } from "../../src/models/taken-segment.ts";
import { TerminalHistorySegment } from "../../src/services/terminal-history-segment.ts";

describe("TakenSegment", () => {
  it("holds its segment and the bytes taken from it", () => {
    const segment: TerminalHistorySegment = new TerminalHistorySegment("history/0.txt", 0);
    const buffer: Buffer = Buffer.from("line\n");

    const taken: TakenSegment = new TakenSegment(segment, buffer);

    assert.equal(taken.segment, segment);
    assert.equal(taken.buffer, buffer);
  });
});
