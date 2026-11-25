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

import { ShellCandidate } from "../../src/models/shell-candidate.ts";

describe("ShellCandidate", () => {
  it("holds its id, name, kind, files and arguments", () => {
    const candidate: ShellCandidate = new ShellCandidate("zsh", "Zsh", TerminalShellKind.Zsh, ["/bin/zsh", "/usr/bin/zsh"], ["-l"]);

    assert.equal(candidate.id, "zsh");
    assert.equal(candidate.name, "Zsh");
    assert.equal(candidate.kind, TerminalShellKind.Zsh);
    assert.deepEqual(candidate.files, ["/bin/zsh", "/usr/bin/zsh"]);
    assert.deepEqual(candidate.args, ["-l"]);
  });
});
