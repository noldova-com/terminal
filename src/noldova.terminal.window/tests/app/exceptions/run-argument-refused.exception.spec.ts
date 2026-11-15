/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { RunArgumentRefusedException } from "../../../src/app/exceptions/run-argument-refused.exception.ts";
import { TerminalRunRefusedException } from "../../../src/app/exceptions/terminal-run-refused.exception.ts";

describe("RunArgumentRefusedException", () => {
  it("says the commands weren't run and why, and names the refused field, as a run refusal", () => {
    const error: RunArgumentRefusedException = new RunArgumentRefusedException("command", "command must not be blank.");

    expect(error).toBeInstanceOf(TerminalRunRefusedException);
    expect([error.name, error.message, error.parameter, error.reason]).toEqual(["RunArgumentRefusedException",
      "The commands weren't run, and nothing opened: command must not be blank.", "command", "command must not be blank."]);
  });
});
