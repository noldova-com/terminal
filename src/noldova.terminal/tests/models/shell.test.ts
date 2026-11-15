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

import { Shell } from "../../src/models/shell.ts";

describe("Shell", () => {
  it("offers its id, name, kind and default flag to the window", () => {
    const shell: Shell = new Shell("git-bash", "Git Bash", TerminalShellKind.Bash, "C:\\Git\\bin\\bash.exe", ["--login", "-i"], false);

    assert.equal(shell.file, "C:\\Git\\bin\\bash.exe");
    assert.deepEqual(shell.args, ["--login", "-i"]);
    assert.equal(shell.startCommand, null);
    assert.deepEqual(shell.toTerminalShell().toJson(), { id: "git-bash", name: "Git Bash", kind: "Bash", isDefault: false });
  });
});
