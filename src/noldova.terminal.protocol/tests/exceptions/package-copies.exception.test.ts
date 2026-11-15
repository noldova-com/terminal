/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { Exception } from "@noldova/context.exceptions";
import { describe, it } from "vitest";

import { PackageCopiesException } from "../../src/exceptions/package-copies.exception.ts";
import { TerminalProtocolException } from "../../src/exceptions/terminal-protocol.exception.ts";

describe("PackageCopiesException", () => {
  it("carries its name and formats its own message, which names the package and what to install", () => {
    const error: PackageCopiesException = new PackageCopiesException();

    assert.ok(error instanceof TerminalProtocolException);
    assert.ok(error instanceof Exception);
    assert.equal(error.name, "PackageCopiesException");
    assert.equal(error.message, "The terminal.owners service comes from another installed copy of @noldova/terminal.protocol: "
      + "install one copy, at Terminal's version, so that RuntimeTerminalOwners matches it.");
  });
});
