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
import { EnvironmentKeyUnreadableException } from "../../src/exceptions/environment-key-unreadable.exception.ts";
import { EnvironmentUnreadableException } from "../../src/exceptions/environment-unreadable.exception.ts";
import { SystemRootMissingException } from "../../src/exceptions/system-root-missing.exception.ts";
import { TerminalException } from "../../src/exceptions/terminal.exception.ts";

describe("EnvironmentUnreadableException", () => {
  it("is the base of every way the Windows environment can't be read, as a TerminalException", () => {
    const errors: readonly Error[] = [new EnvironmentExportInvalidException(), new EnvironmentKeyUnreadableException("HKCU\\Environment", new Error("Denied.")),
      new SystemRootMissingException()];

    assert.deepEqual(errors.filter(t => !(t instanceof EnvironmentUnreadableException && t instanceof TerminalException)).map(t => t.name), []);
  });
});
