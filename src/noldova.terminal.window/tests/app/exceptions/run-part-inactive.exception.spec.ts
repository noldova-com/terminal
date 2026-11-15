/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { RunPartInactiveException } from "../../../src/app/exceptions/run-part-inactive.exception.ts";
import { TerminalRunRefusedException } from "../../../src/app/exceptions/terminal-run-refused.exception.ts";

describe("RunPartInactiveException", () => {
  it("says the commands weren't run since the window part isn't active, as a run refusal of the context", () => {
    const error: RunPartInactiveException = new RunPartInactiveException();

    expect(error).toBeInstanceOf(TerminalRunRefusedException);
    expect([error.name, error.message, error.parameter]).toEqual(["RunPartInactiveException",
      "The commands weren't run, and nothing opened: the terminal's window part isn't active in this window.", "context"]);
  });
});
