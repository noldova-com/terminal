/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalShellKind } from "@noldova/terminal.protocol";
import { describe, expect, it } from "vitest";

import { RunShellKindsMissingException } from "../../../src/app/exceptions/run-shell-kinds-missing.exception.ts";
import { TerminalRunRefusedException } from "../../../src/app/exceptions/terminal-run-refused.exception.ts";

describe("RunShellKindsMissingException", () => {
  it("says the commands weren't run and names the kinds no installed shell has, as a run refusal of the shell kinds", () => {
    const error: RunShellKindsMissingException = new RunShellKindsMissingException([TerminalShellKind.Bash, TerminalShellKind.Zsh]);

    expect(error).toBeInstanceOf(TerminalRunRefusedException);
    expect([error.name, error.message, error.parameter, error.shellKinds]).toEqual(["RunShellKindsMissingException",
      "The commands weren't run, and nothing opened: no shell of the kinds they need is installed (Bash or Zsh).", "shellKinds", ["Bash", "Zsh"]]);
  });
});
