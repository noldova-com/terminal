/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { TerminalShellKind } from "@noldova/terminal.protocol";
import { describe, it } from "vitest";

import { ShellKindNotFoundException } from "../../src/exceptions/shell-kind-not-found.exception.ts";

describe("ShellKindNotFoundException", () => {
  it("names the kinds of shell none of which is installed, keeping its own copy", () => {
    const kinds: TerminalShellKind[] = [TerminalShellKind.PowerShell, TerminalShellKind.CommandPrompt];
    const error: ShellKindNotFoundException = new ShellKindNotFoundException(kinds);
    kinds.push(TerminalShellKind.Wsl);

    assert.ok(error instanceof Error);
    assert.equal(error.name, "ShellKindNotFoundException");
    assert.deepEqual(error.shellKinds, ["PowerShell", "CommandPrompt"]);
    assert.equal(error.message, "No installed shell is of the kinds PowerShell, CommandPrompt.");
  });
});
