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
import { AbortReasonUnknownException } from "../../../src/tools/exceptions/abort-reason-unknown.exception.ts";

describe("AbortReasonUnknownException", () => {
  it("keeps the reason a call's signal aborted with, which is not a tool abort reason", () => {
    const reason: { readonly kind: string } = { kind: "Stopped" };
    const error: AbortReasonUnknownException = new AbortReasonUnknownException(reason);

    assert.ok(error instanceof TerminalException);
    assert.equal(error.name, "AbortReasonUnknownException");
    assert.equal(error.reason, reason);
    assert.equal(error.message, "A tool call ended with the abort reason { kind: 'Stopped' }, which is not one of Noldova Desktop's tool abort reasons.");
  });
});
