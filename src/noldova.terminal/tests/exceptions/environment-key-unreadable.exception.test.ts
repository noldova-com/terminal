/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ProcessExit } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { CommandExitedException } from "../../src/exceptions/command-exited.exception.ts";
import { EnvironmentKeyUnreadableException } from "../../src/exceptions/environment-key-unreadable.exception.ts";
import { EnvironmentUnreadableException } from "../../src/exceptions/environment-unreadable.exception.ts";

describe("EnvironmentKeyUnreadableException", () => {
  it("names the key that could not be read, and keeps why as its cause", () => {
    const cause: CommandExitedException = new CommandExitedException("reg.exe", new ProcessExit(1, null), "ERROR: Access is denied.");
    const error: EnvironmentKeyUnreadableException = new EnvironmentKeyUnreadableException("HKCU\\Environment", cause);

    assert.ok(error instanceof EnvironmentUnreadableException);
    assert.equal(error.name, "EnvironmentKeyUnreadableException");
    assert.equal(error.key, "HKCU\\Environment");
    assert.equal(error.message, "The key HKCU\\Environment could not be read.");
    assert.equal(error.cause, cause);
  });
});
