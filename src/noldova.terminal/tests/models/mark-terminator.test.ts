/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { MarkTerminator } from "../../src/models/mark-terminator.ts";

describe("MarkTerminator", () => {
  it("holds where the mark's payload ends and where the mark ends", () => {
    const terminator: MarkTerminator = new MarkTerminator(10, 12);

    assert.equal(terminator.payloadEnd, 10);
    assert.equal(terminator.end, 12);
  });
});
