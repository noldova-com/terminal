/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalShellKind } from "../../src/enums/terminal-shell-kind.ts";
import { TerminalShell } from "../../src/models/terminal-shell.ts";
import { TerminalShells } from "../../src/models/terminal-shells.ts";

describe("TerminalShells", () => {
  it("writes and reads its shells in order", () => {
    const json: object = {
      shells: [{ id: "zsh", name: "zsh", kind: "Zsh", isDefault: true }, { id: "bash", name: "Bash", kind: "Bash", isDefault: false }]
    };

    assert.deepEqual(TerminalShells.fromJson(json).shells.map(t => t.id), ["zsh", "bash"]);
    assert.deepEqual(new TerminalShells([
      new TerminalShell("zsh", "zsh", TerminalShellKind.Zsh, true),
      new TerminalShell("bash", "Bash", TerminalShellKind.Bash, false)
    ]).toJson(), json);
  });

  it("names the shell it cannot read", () => {
    assert.throws(() => TerminalShells.fromJson({ shells: [{ id: "zsh", name: "zsh", kind: "Zsh" }] }), { name: "JsonException", path: "$.shells.0.isDefault" });
  });

  it("keeps its own copy of the shells", () => {
    const shells: TerminalShell[] = [];
    const answer: TerminalShells = new TerminalShells(shells);
    shells.push(new TerminalShell("bash", "Bash", TerminalShellKind.Bash, true));

    assert.deepEqual(answer.shells, []);
  });
});
