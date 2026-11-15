/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ShellsUnreadableException } from "../../src/exceptions/shells-unreadable.exception.ts";
import { VisualStudioUnreadableException } from "../../src/exceptions/visual-studio-unreadable.exception.ts";

describe("VisualStudioUnreadableException", () => {
  it("says Visual Studio's shells are left out, and keeps why as its cause", () => {
    const cause: Error = new Error("vswhere.exe exited with 4.");
    const error: VisualStudioUnreadableException = new VisualStudioUnreadableException(cause);

    assert.ok(error instanceof ShellsUnreadableException);
    assert.equal(error.name, "VisualStudioUnreadableException");
    assert.equal(error.message, "The shell list leaves out Visual Studio's developer shells, since its installations could not be read.");
    assert.equal(error.cause, cause);
  });

  it("has no cause when none is given", () => {
    assert.equal(new VisualStudioUnreadableException().cause, undefined);
  });
});
