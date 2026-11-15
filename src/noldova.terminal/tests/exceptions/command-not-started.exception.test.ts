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
import { CommandNotStartedException } from "../../src/exceptions/command-not-started.exception.ts";

describe("CommandNotStartedException", () => {
  it("names the command that could not start, and keeps why as its cause", () => {
    const cause: Error = new Error("refused");
    const error: CommandNotStartedException = new CommandNotStartedException("git", cause);

    assert.ok(error instanceof CommandFailedException);
    assert.equal(error.name, "CommandNotStartedException");
    assert.equal(error.command, "git");
    assert.equal(error.message, "git could not start.");
    assert.equal(error.cause, cause);
  });
});
