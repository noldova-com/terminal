/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { EnvironmentExportInvalidException } from "../../src/exceptions/environment-export-invalid.exception.ts";
import { EnvironmentUnreadableException } from "../../src/exceptions/environment-unreadable.exception.ts";

describe("EnvironmentExportInvalidException", () => {
  it("says reg.exe's export could not be read", () => {
    const error: EnvironmentExportInvalidException = new EnvironmentExportInvalidException();

    assert.ok(error instanceof EnvironmentUnreadableException);
    assert.equal(error.name, "EnvironmentExportInvalidException");
    assert.equal(error.message, "reg.exe did not export the machine's and the person's variables in a form that could be read.");
    assert.equal(error.cause, undefined);
  });
});
