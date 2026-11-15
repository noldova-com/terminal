/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostEndedException } from "../../src/exceptions/host-ended.exception.ts";

describe("HostEndedException", () => {
  it("says the terminals have ended", () => {
    const error: HostEndedException = new HostEndedException();

    assert.ok(error instanceof Error);
    assert.equal(error.name, "HostEndedException");
    assert.equal(error.message, "The terminals have ended, so no shell starts.");
  });
});
