/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ProcessExit } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { CommandExitedException } from "../../src/exceptions/command-exited.exception.ts";
import { CommandFailedException } from "../../src/exceptions/command-failed.exception.ts";
import { CommandNotStartedException } from "../../src/exceptions/command-not-started.exception.ts";
import { CommandOutputTooLongException } from "../../src/exceptions/command-output-too-long.exception.ts";
import { CommandTimedOutException } from "../../src/exceptions/command-timed-out.exception.ts";
import { CommandVariableNotSetException } from "../../src/exceptions/command-variable-not-set.exception.ts";
import { TerminalException } from "../../src/exceptions/terminal.exception.ts";

describe("CommandFailedException", () => {
  it("is the base of every way a command fails, as a TerminalException", () => {
    const errors: readonly Error[] = [
      new CommandNotStartedException("git", new Error("refused")),
      new CommandTimedOutException("git", 2_000),
      new CommandOutputTooLongException("git", 4_194_304),
      new CommandExitedException("git", new ProcessExit(1, null)),
      new CommandVariableNotSetException("icacls.exe", "SystemRoot")
    ];

    assert.deepEqual(errors.filter(t => !(t instanceof CommandFailedException && t instanceof TerminalException)).map(t => t.name), []);
  });
});
