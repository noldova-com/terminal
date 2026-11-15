/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { CommandFailedException } from "../../src/exceptions/command-failed.exception.ts";
import { CommandVariableNotSetException } from "../../src/exceptions/command-variable-not-set.exception.ts";

describe("CommandVariableNotSetException", () => {
  it("names the command and the variable it needs to start", () => {
    const error: CommandVariableNotSetException = new CommandVariableNotSetException("icacls.exe", "SystemRoot");

    assert.ok(error instanceof CommandFailedException);
    assert.equal(error.name, "CommandVariableNotSetException");
    assert.equal(error.command, "icacls.exe");
    assert.equal(error.variable, "SystemRoot");
    assert.equal(error.message, "icacls.exe could not start: SystemRoot isn't set.");
  });
});
