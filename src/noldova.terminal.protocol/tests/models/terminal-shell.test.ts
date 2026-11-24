/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalShellKind } from "../../src/enums/terminal-shell-kind.ts";
import { TerminalShell } from "../../src/models/terminal-shell.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalShellTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const shell: TerminalShell = TerminalShell.fromJson({ id: "pwsh", name: "PowerShell 7", kind: "PowerShell", isDefault: true });

    Assert.areEqual("pwsh", shell.id);
    Assert.areEqual("PowerShell 7", shell.name);
    Assert.areEqual(TerminalShellKind.PowerShell, shell.kind);
    Assert.areEqual(true, shell.isDefault);
    Expect.same({ id: "bash", name: "Bash", kind: "Bash", isDefault: false }, new TerminalShell("bash", "Bash", TerminalShellKind.Bash, false).toJson());
  }

  @TestMethod
  public refusesABlankName(): void {
    Assert.throws(() => new TerminalShell("bash", " ", TerminalShellKind.Bash, false), ArgumentException);
    Expect.throwsMatching(() => TerminalShell.fromJson({ id: "bash", name: "", kind: "Bash", isDefault: false }), { name: "JsonException", path: "$.name" });
  }

  @TestMethod
  public readsEveryKindAndRefusesAKindItDoesntKnowOrAMissingOne(): void {
    for (const kind of Object.values(TerminalShellKind))
      Assert.areEqual(kind, TerminalShell.fromJson({ id: "sh", name: "sh", kind, isDefault: false }).kind);
    Expect.throwsMatching(() => TerminalShell.fromJson({ id: "sh", name: "sh", kind: "Csh", isDefault: false }), { name: "JsonException", path: "$.kind" });
    Expect.throwsMatching(() => TerminalShell.fromJson({ id: "sh", name: "sh", isDefault: false }), { name: "JsonException", path: "$.kind" });
  }

  @TestMethod
  public refusesABlankIdAndANameLongerThanItsLimit(): void {
    for (const id of ["", " "])
      Expect.throwsMatching(() => new TerminalShell(id, "Bash", TerminalShellKind.Bash, false), { name: "ArgumentException", parameterName: "id" });
    Assert.areEqual(200, new TerminalShell("bash", "n".repeat(200), TerminalShellKind.Bash, false).name.length);
    Expect.throwsMatching(() => new TerminalShell("bash", "n".repeat(201), TerminalShellKind.Bash, false), { name: "ArgumentException", parameterName: "name" });
  }
}
