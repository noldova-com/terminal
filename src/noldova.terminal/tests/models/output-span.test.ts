/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { OutputSpan } from "../../src/models/output-span.ts";

describe("OutputSpan", () => {
  it("holds its start and end", () => {
    const span: OutputSpan = new OutputSpan(3, 9);

    assert.equal(span.start, 3);
    assert.equal(span.end, 9);
  });
});
