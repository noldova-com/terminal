/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ShellsUnreadableException } from "../../src/exceptions/shells-unreadable.exception.ts";
import { WslDistributionsUnreadableException } from "../../src/exceptions/wsl-distributions-unreadable.exception.ts";

describe("WslDistributionsUnreadableException", () => {
  it("says the WSL distributions are left out, and keeps why as its cause", () => {
    const cause: Error = new Error("powershell.exe exited with 3.");
    const error: WslDistributionsUnreadableException = new WslDistributionsUnreadableException(cause);

    assert.ok(error instanceof ShellsUnreadableException);
    assert.equal(error.name, "WslDistributionsUnreadableException");
    assert.equal(error.message, "The shell list leaves out the WSL distributions, which could not be read.");
    assert.equal(error.cause, cause);
  });

  it("has no cause when none is given", () => {
    assert.equal(new WslDistributionsUnreadableException().cause, undefined);
  });
});
