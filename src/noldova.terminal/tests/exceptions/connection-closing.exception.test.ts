/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ConnectionClosingException } from "../../src/exceptions/connection-closing.exception.ts";

describe("ConnectionClosingException", () => {
  it("says the connection that sent the run is closing", () => {
    const error: ConnectionClosingException = new ConnectionClosingException();

    assert.ok(error instanceof Error);
    assert.equal(error.name, "ConnectionClosingException");
    assert.equal(error.message, "The connection that sent the run is closing, so the run types nothing and opens no terminal.");
  });
});
