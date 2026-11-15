/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { EnvironmentUnreadableException } from "../../src/exceptions/environment-unreadable.exception.ts";
import { SystemRootMissingException } from "../../src/exceptions/system-root-missing.exception.ts";

describe("SystemRootMissingException", () => {
  it("says SystemRoot is not set, so reg.exe can't be found", () => {
    const error: SystemRootMissingException = new SystemRootMissingException();

    assert.ok(error instanceof EnvironmentUnreadableException);
    assert.equal(error.name, "SystemRootMissingException");
    assert.equal(error.message, "SystemRoot is not set, so reg.exe can't be found.");
  });
});
