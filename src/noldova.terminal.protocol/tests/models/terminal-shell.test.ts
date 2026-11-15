/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ArgumentException } from "@noldova/context.exceptions";
import { describe, it } from "vitest";

import { TerminalShellKind } from "../../src/enums/terminal-shell-kind.ts";
import { TerminalShell } from "../../src/models/terminal-shell.ts";

describe("TerminalShell", () => {
  it("writes and reads its wire form", () => {
    const shell: TerminalShell = TerminalShell.fromJson({ id: "pwsh", name: "PowerShell 7", kind: "PowerShell", isDefault: true });

    assert.equal(shell.id, "pwsh");
    assert.equal(shell.name, "PowerShell 7");
    assert.equal(shell.kind, TerminalShellKind.PowerShell);
    assert.equal(shell.isDefault, true);
    assert.deepEqual(new TerminalShell("bash", "Bash", TerminalShellKind.Bash, false).toJson(), { id: "bash", name: "Bash", kind: "Bash", isDefault: false });
  });

  it("refuses a blank name", () => {
    assert.throws(() => new TerminalShell("bash", " ", TerminalShellKind.Bash, false), ArgumentException);
    assert.throws(() => TerminalShell.fromJson({ id: "bash", name: "", kind: "Bash", isDefault: false }), { name: "JsonException", path: "$.name" });
  });

  it("reads every kind, and refuses a kind it doesn't know or a missing one", () => {
    for (const kind of Object.values(TerminalShellKind))
      assert.equal(TerminalShell.fromJson({ id: "sh", name: "sh", kind, isDefault: false }).kind, kind);
    assert.throws(() => TerminalShell.fromJson({ id: "sh", name: "sh", kind: "Csh", isDefault: false }), { name: "JsonException", path: "$.kind" });
    assert.throws(() => TerminalShell.fromJson({ id: "sh", name: "sh", isDefault: false }), { name: "JsonException", path: "$.kind" });
  });

  it("refuses a blank id and a name longer than its limit", () => {
    for (const id of ["", " "])
      assert.throws(() => new TerminalShell(id, "Bash", TerminalShellKind.Bash, false), { name: "ArgumentException", parameterName: "id" });
    assert.equal(new TerminalShell("bash", "n".repeat(200), TerminalShellKind.Bash, false).name.length, 200);
    assert.throws(() => new TerminalShell("bash", "n".repeat(201), TerminalShellKind.Bash, false), { name: "ArgumentException", parameterName: "name" });
  });
});
