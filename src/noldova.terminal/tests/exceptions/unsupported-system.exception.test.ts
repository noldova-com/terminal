/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { SystemRequirement } from "../../src/enums/system-requirement.ts";
import { TerminalException } from "../../src/exceptions/terminal.exception.ts";
import { UnsupportedSystemException } from "../../src/exceptions/unsupported-system.exception.ts";

describe("UnsupportedSystemException", () => {
  it("names the Windows build it found below the minimum, as a TerminalException with no cause", () => {
    const error: UnsupportedSystemException = new UnsupportedSystemException(SystemRequirement.WindowsBuild, "17134");

    assert.ok(error instanceof TerminalException);
    assert.equal(error.name, "UnsupportedSystemException");
    assert.equal(error.requirement, SystemRequirement.WindowsBuild);
    assert.equal(error.found, "17134");
    assert.equal(error.message, "The terminal module needs Windows 10 version 1809 (build 17763) or later for its pseudo console; this system is build 17134.");
    assert.equal(error.cause, undefined);
  });

  it("names the glibc it found below the minimum", () => {
    const error: UnsupportedSystemException = new UnsupportedSystemException(SystemRequirement.Glibc, "2.27");

    assert.equal(error.requirement, SystemRequirement.Glibc);
    assert.equal(error.found, "2.27");
    assert.equal(error.message, "The terminal module needs glibc 2.28 or later for its pseudo-terminal library; this system has glibc 2.27.");
  });
});
