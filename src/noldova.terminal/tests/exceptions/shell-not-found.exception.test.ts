/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { ShellNotFoundException } from "../../src/exceptions/shell-not-found.exception.ts";

describe("ShellNotFoundException", () => {
  it("names the shell id it did not find, as a NotFound failure the window reads", () => {
    const error: ShellNotFoundException = new ShellNotFoundException("fish");

    assert.ok(error instanceof Error);
    assert.equal(error.name, "ShellNotFoundException");
    assert.equal(error.shellId, "fish");
    assert.equal(error.message, "No shell has the id fish.");
    assert.ok(error instanceof MethodFailureException);
    assert.deepEqual([error.failure.code, error.failure.message], [FailureCode.NotFound, "No shell has the id fish."]);
  });
});
