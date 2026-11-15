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

describe("CommandExitedException", () => {
  it("names the command and the code it exited with", () => {
    const error: CommandExitedException = new CommandExitedException("reg.exe", new ProcessExit(1, null));

    assert.ok(error instanceof CommandFailedException);
    assert.equal(error.name, "CommandExitedException");
    assert.equal(error.command, "reg.exe");
    assert.equal(error.exitCode, 1);
    assert.equal(error.signal, null);
    assert.equal(error.errorText, "");
    assert.equal(error.message, "reg.exe exited with 1.");
  });

  it("adds what the command wrote to its errors, on one line, and leaves out errors of only spaces", () => {
    const said: CommandExitedException = new CommandExitedException("reg.exe", new ProcessExit(1, null), "\r\nERROR: The system was unable\r\n  to find the key.\r\n");
    const blank: CommandExitedException = new CommandExitedException("reg.exe", new ProcessExit(1, null), " \r\n\t");

    assert.deepEqual([said.errorText, said.message], ["ERROR: The system was unable to find the key.", "reg.exe exited with 1: ERROR: The system was unable to find the key."]);
    assert.deepEqual([blank.errorText, blank.message], ["", "reg.exe exited with 1."]);
  });

  it("names the signal that ended the command when it has no code", () => {
    const error: CommandExitedException = new CommandExitedException("node", new ProcessExit(null, "SIGKILL"));

    assert.equal(error.exitCode, null);
    assert.equal(error.signal, "SIGKILL");
    assert.equal(error.message, "node exited with SIGKILL.");
  });
});
