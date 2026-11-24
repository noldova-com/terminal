/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalShellKind } from "../../src/enums/terminal-shell-kind.ts";
import { TerminalShell } from "../../src/models/terminal-shell.ts";
import { TerminalShells } from "../../src/models/terminal-shells.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalShellsTests {
  @TestMethod
  public writesAndReadsItsShellsInOrder(): void {
    const json: object = {
      shells: [{ id: "zsh", name: "zsh", kind: "Zsh", isDefault: true }, { id: "bash", name: "Bash", kind: "Bash", isDefault: false }]
    };

    Expect.same(["zsh", "bash"], TerminalShells.fromJson(json).shells.map(t => t.id));
    Expect.same(json, new TerminalShells([
      new TerminalShell("zsh", "zsh", TerminalShellKind.Zsh, true),
      new TerminalShell("bash", "Bash", TerminalShellKind.Bash, false)
    ]).toJson());
  }

  @TestMethod
  public namesTheShellItCannotRead(): void {
    Expect.throwsMatching(() => TerminalShells.fromJson({ shells: [{ id: "zsh", name: "zsh", kind: "Zsh" }] }), { name: "JsonException", path: "$.shells.0.isDefault" });
  }

  @TestMethod
  public keepsItsOwnCopyOfTheShells(): void {
    const shells: TerminalShell[] = [];
    const answer: TerminalShells = new TerminalShells(shells);
    shells.push(new TerminalShell("bash", "Bash", TerminalShellKind.Bash, true));

    Expect.same([], answer.shells);
  }
}
