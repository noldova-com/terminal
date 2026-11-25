/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { MarkIntroducer } from "../../src/models/mark-introducer.ts";

describe("MarkIntroducer", () => {
  it("holds where the mark starts and its text", () => {
    const introducer: MarkIntroducer = new MarkIntroducer(4, "\u001b]633;");

    assert.equal(introducer.start, 4);
    assert.equal(introducer.text, "\u001b]633;");
  });
});
