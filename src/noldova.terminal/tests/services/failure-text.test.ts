/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { CommandNotStartedException } from "../../src/exceptions/command-not-started.exception.ts";
import { VisualStudioUnreadableException } from "../../src/exceptions/visual-studio-unreadable.exception.ts";
import { FailureText } from "../../src/services/failure-text.ts";

describe("FailureText", () => {
  it("reads an error's message, and a value that isn't an error as text", () => {
    assert.deepEqual([FailureText.read(new Error("Disk full.")), FailureText.read("refused"), FailureText.read(5)], ["Disk full.", "refused", "5"]);
  });

  it("follows each cause after the message", () => {
    const error: VisualStudioUnreadableException = new VisualStudioUnreadableException(new CommandNotStartedException("vswhere.exe", "refused"));

    assert.equal(FailureText.read(error),
      "The shell list leaves out Visual Studio's developer shells, since its installations could not be read. vswhere.exe could not start. refused");
  });
});
