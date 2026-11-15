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
import { CommandTimedOutException } from "../../src/exceptions/command-timed-out.exception.ts";

describe("CommandTimedOutException", () => {
  it("names the command and the time it ran past, with no cause", () => {
    const error: CommandTimedOutException = new CommandTimedOutException("reg.exe", 5_000);

    assert.ok(error instanceof CommandFailedException);
    assert.equal(error.name, "CommandTimedOutException");
    assert.equal(error.command, "reg.exe");
    assert.equal(error.timeoutMilliseconds, 5_000);
    assert.equal(error.message, "reg.exe did not end within 5 seconds.");
    assert.equal(error.cause, undefined);
  });
});
