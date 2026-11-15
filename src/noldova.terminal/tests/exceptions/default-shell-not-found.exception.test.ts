/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { DefaultShellNotFoundException } from "../../src/exceptions/default-shell-not-found.exception.ts";

describe("DefaultShellNotFoundException", () => {
  it("says no default shell was found", () => {
    const error: DefaultShellNotFoundException = new DefaultShellNotFoundException();

    assert.ok(error instanceof Error);
    assert.equal(error.name, "DefaultShellNotFoundException");
    assert.equal(error.message, "No default shell was found.");
  });
});
