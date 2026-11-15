/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { StoredLinesDamagedException } from "../../src/exceptions/stored-lines-damaged.exception.ts";
import { TerminalException } from "../../src/exceptions/terminal.exception.ts";

describe("StoredLinesDamagedException", () => {
  it("says the terminal's stored lines are damaged, as a TerminalException with no cause", () => {
    const error: StoredLinesDamagedException = new StoredLinesDamagedException();

    assert.ok(error instanceof TerminalException);
    assert.equal(error.name, "StoredLinesDamagedException");
    assert.equal(error.message, "The terminal's stored lines are damaged.");
    assert.equal(error.cause, undefined);
  });

  it("keeps the failure that showed the damage as its cause", () => {
    const cause: SyntaxError = new SyntaxError("Unexpected end of JSON input");
    const error: StoredLinesDamagedException = new StoredLinesDamagedException(cause);

    assert.equal(error.message, "The terminal's stored lines are damaged.");
    assert.equal(error.cause, cause);
  });
});
