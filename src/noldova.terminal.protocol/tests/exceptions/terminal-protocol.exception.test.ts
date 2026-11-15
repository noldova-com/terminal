/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { Exception, ExceptionOptions } from "@noldova/context.exceptions";
import { describe, it } from "vitest";

import { TerminalProtocolException } from "../../src/exceptions/terminal-protocol.exception.ts";

describe("TerminalProtocolException", () => {
  it("carries its name and message, as a context Exception", () => {
    const error: TerminalProtocolException = new TerminalProtocolException("The protocol failed.");

    assert.ok(error instanceof Exception);
    assert.equal(error.name, "TerminalProtocolException");
    assert.equal(error.message, "The protocol failed.");
    assert.equal(error.cause, undefined);
  });

  it("keeps the cause it is given through ExceptionOptions", () => {
    const cause: Error = new Error("The stream closed.");

    const error: TerminalProtocolException = new TerminalProtocolException("The protocol failed.", new ExceptionOptions(cause));

    assert.equal(error.message, "The protocol failed.");
    assert.equal(error.cause, cause);
  });
});
