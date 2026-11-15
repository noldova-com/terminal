/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { StoredLinesUnwritableException } from "../../src/exceptions/stored-lines-unwritable.exception.ts";
import { TerminalException } from "../../src/exceptions/terminal.exception.ts";

describe("StoredLinesUnwritableException", () => {
  it("says the terminal's stored lines could not be written, and keeps the cause", () => {
    const cause: Error = new Error("Disk full.");
    const error: StoredLinesUnwritableException = new StoredLinesUnwritableException(cause);

    assert.ok(error instanceof TerminalException);
    assert.equal(error.name, "StoredLinesUnwritableException");
    assert.equal(error.message, "The terminal's stored lines could not be written.");
    assert.equal(error.cause, cause);
  });
});
