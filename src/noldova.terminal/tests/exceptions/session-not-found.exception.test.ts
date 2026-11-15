/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { SessionNotFoundException } from "../../src/exceptions/session-not-found.exception.ts";

describe("SessionNotFoundException", () => {
  it("names the session id it did not find", () => {
    const error: SessionNotFoundException = new SessionNotFoundException("s9");

    assert.ok(error instanceof Error);
    assert.equal(error.name, "SessionNotFoundException");
    assert.equal(error.sessionId, "s9");
    assert.equal(error.message, "No terminal has the session id s9.");
  });
});
