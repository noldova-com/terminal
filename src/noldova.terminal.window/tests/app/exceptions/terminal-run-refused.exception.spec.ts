/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalShellKind } from "@noldova/terminal.protocol";
import { describe, expect, it } from "vitest";

import { RunArgumentRefusedException } from "../../../src/app/exceptions/run-argument-refused.exception.ts";
import { RunPartInactiveException } from "../../../src/app/exceptions/run-part-inactive.exception.ts";
import { RunShellKindsMissingException } from "../../../src/app/exceptions/run-shell-kinds-missing.exception.ts";
import { TerminalRunRefusedException } from "../../../src/app/exceptions/terminal-run-refused.exception.ts";
import { TerminalWindowException } from "../../../src/app/exceptions/terminal-window.exception.ts";

describe("TerminalRunRefusedException", () => {
  it("is the window exception every run refusal extends, each saying the commands weren't run and naming its field", () => {
    const errors: readonly TerminalRunRefusedException[] = [
      new RunPartInactiveException(),
      new RunArgumentRefusedException("owner", "Expected a string that is not blank."),
      new RunShellKindsMissingException([TerminalShellKind.Fish])
    ];

    expect(errors.map(t => t instanceof TerminalWindowException)).toEqual(errors.map(() => true));
    expect(errors.filter(t => !t.message.startsWith("The commands weren't run, and nothing opened: ")).map(t => t.name)).toEqual([]);
    expect(errors.map(t => t.parameter)).toEqual(["context", "owner", "shellKinds"]);
  });
});
