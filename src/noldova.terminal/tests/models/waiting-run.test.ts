/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { WaitingRun } from "../../src/models/waiting-run.ts";

describe("WaitingRun", () => {
  it("holds its run, connection, window, remaining ends, offset and paste, with no exit code and before the end mark", () => {
    const run: WaitingRun = new WaitingRun("r1", 3, 7, 2, 120, "npm test\r");

    assert.equal(run.runId, "r1");
    assert.equal(run.connection, 3);
    assert.equal(run.window, 7);
    assert.equal(run.remainingEnds, 2);
    assert.equal(run.offset, 120);
    assert.equal(run.paste, "npm test\r");
    assert.equal(run.exitCode, null);
    assert.equal(run.isAfterEndMark, false);
  });

  it("holds no window for a run no window started", () => {
    const run: WaitingRun = new WaitingRun("r2", 3, null, 1, 0, "");

    assert.equal(run.window, null);
  });
});
