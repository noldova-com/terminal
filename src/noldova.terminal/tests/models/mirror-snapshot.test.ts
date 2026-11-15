/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { MirrorSnapshot } from "../../src/models/mirror-snapshot.ts";

describe("MirrorSnapshot", () => {
  it("holds the screen, the unfinished sequence and the offset they cover", () => {
    const snapshot: MirrorSnapshot = new MirrorSnapshot("screen", "\u001b[", 9);

    assert.equal(snapshot.snapshot, "screen");
    assert.equal(snapshot.pending, "\u001b[");
    assert.equal(snapshot.offset, 9);
  });
});
