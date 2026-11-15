/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { PaneProgress } from "../../src/models/pane-progress.ts";

describe("PaneProgress", () => {
  it("starts visible at its offset with no stall timer", () => {
    const progress: PaneProgress = new PaneProgress(5);

    assert.equal(progress.offset, 5);
    assert.equal(progress.isVisible, true);
    assert.equal(progress.stallTimer, null);
  });
});
