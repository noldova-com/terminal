/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { UnknownMethodException } from "../../src/exceptions/unknown-method.exception.ts";

describe("UnknownMethodException", () => {
  it("names the method it does not have", () => {
    const error: UnknownMethodException = new UnknownMethodException("terminal.unknown");

    assert.ok(error instanceof Error);
    assert.equal(error.name, "UnknownMethodException");
    assert.equal(error.method, "terminal.unknown");
    assert.equal(error.message, "The terminal module has no method terminal.unknown.");
  });
});
