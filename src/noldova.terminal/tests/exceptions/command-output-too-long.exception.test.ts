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
import { CommandOutputTooLongException } from "../../src/exceptions/command-output-too-long.exception.ts";

describe("CommandOutputTooLongException", () => {
  it("names the command and the output limit it passed", () => {
    const error: CommandOutputTooLongException = new CommandOutputTooLongException("vswhere.exe", 4_194_304);

    assert.ok(error instanceof CommandFailedException);
    assert.equal(error.name, "CommandOutputTooLongException");
    assert.equal(error.command, "vswhere.exe");
    assert.equal(error.limit, 4_194_304);
    assert.equal(error.message, "vswhere.exe wrote more output than the terminal module reads, so it was stopped.");
  });
});
