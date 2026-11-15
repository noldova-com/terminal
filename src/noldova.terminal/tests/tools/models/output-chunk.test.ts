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

import { OutputChunk } from "../../../src/tools/models/output-chunk.ts";

describe("OutputChunk", () => {
  it("keeps the text and the offset after it", () => {
    const chunk: OutputChunk = new OutputChunk("ok\n", 12);

    assert.equal(chunk.text, "ok\n");
    assert.equal(chunk.endOffset, 12);
  });

  it("refuses a negative or fractional offset", () => {
    assert.throws(() => new OutputChunk("", -1), ArgumentException);
    assert.throws(() => new OutputChunk("", 1.5), ArgumentException);
  });
});
