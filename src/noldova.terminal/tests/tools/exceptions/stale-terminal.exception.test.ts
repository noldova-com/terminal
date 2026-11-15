/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalException } from "../../../src/exceptions/terminal.exception.ts";
import { StaleTerminalException } from "../../../src/tools/exceptions/stale-terminal.exception.ts";

describe("StaleTerminalException", () => {
  it("names the terminal whose state changed", () => {
    const error: StaleTerminalException = new StaleTerminalException("t1");

    assert.ok(error instanceof TerminalException);
    assert.equal(error.name, "StaleTerminalException");
    assert.equal(error.terminalId, "t1");
    assert.equal(error.message, "Terminal t1 changed after the person allowed the action, so nothing was sent.");
  });
});
