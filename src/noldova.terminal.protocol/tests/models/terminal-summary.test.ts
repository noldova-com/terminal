/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { EndedBy, TerminalExit, TerminalShellKind, TerminalSummary } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalSummaryTests {
  @TestMethod
  public writesAndReadsARunningTerminal(): void {
    const json: object = { sessionId: "s1", shellId: "bash", folder: "/work", title: "~", exit: null, isAgentTerminal: false,
      isPanelTerminal: true, owner: null, opensTab: true, name: null, shellName: null, shellKind: "Other" };

    Expect.same(json, TerminalSummary.fromJson(json).toJson());
    Assert.areEqual(null, TerminalSummary.fromJson(json).exit);
    Assert.areEqual(true, TerminalSummary.fromJson(json).isPanelTerminal);
  }

  @TestMethod
  public writesAndReadsAnEndedAgentTerminal(): void {
    const summary: TerminalSummary = new TerminalSummary("s1", "bash", "/work", "", new TerminalExit(0, EndedBy.Exit), true, false, null, true, null, null,
      TerminalShellKind.Other);

    Expect.same({
      sessionId: "s1",
      shellId: "bash",
      folder: "/work",
      title: "",
      exit: { exitCode: 0, endedBy: "Exit" },
      isAgentTerminal: true,
      isPanelTerminal: false,
      owner: null, opensTab: true, name: null, shellName: null, shellKind: "Other"
    }, summary.toJson());
    Assert.areEqual(0, TerminalSummary.fromJson(summary.toJson()).exit?.exitCode);
    Assert.areEqual(true, TerminalSummary.fromJson(summary.toJson()).isAgentTerminal);
  }

  @TestMethod
  public writesAndReadsItsOwner(): void {
    const json: object = { sessionId: "s1", shellId: "bash", folder: "/work", title: "", exit: null, isAgentTerminal: false,
      isPanelTerminal: false, owner: "example.chat/42", opensTab: true, name: null, shellName: null, shellKind: "Other" };

    Assert.areEqual("example.chat/42", TerminalSummary.fromJson(json).owner);
    Expect.same(json, new TerminalSummary("s1", "bash", "/work", "", null, false, false, "example.chat/42", true, null, null, TerminalShellKind.Other).toJson());
    Expect.throwsMatching(() => new TerminalSummary("s1", "bash", "/work", "", null, false, false, " ", true, null, null, TerminalShellKind.Other), { name: "ArgumentException", parameterName: "owner" });
    Expect.throwsMatching(() => TerminalSummary.fromJson({ ...json, owner: undefined }), { name: "JsonException", path: "$.owner" });
  }

  @TestMethod
  public writesAndReadsThePersonsNameForIt(): void {
    const json: object = { sessionId: "s1", shellId: "bash", folder: "/work", title: "vim", exit: null, isAgentTerminal: false,
      isPanelTerminal: false, owner: null, opensTab: true, name: "Server", shellName: null, shellKind: "Other" };

    Assert.areEqual("Server", TerminalSummary.fromJson(json).name);
    Expect.same(json, new TerminalSummary("s1", "bash", "/work", "vim", null, false, false, null, true, "Server", null, TerminalShellKind.Other).toJson());
    Expect.throwsMatching(() => new TerminalSummary("s1", "bash", "/work", "", null, false, false, null, true, " ", null, TerminalShellKind.Other), { name: "ArgumentException", parameterName: "name" });
    Expect.throwsMatching(() => TerminalSummary.fromJson({ ...json, name: undefined }), { name: "JsonException", path: "$.name" });
  }

  @TestMethod
  public writesAndReadsItsShellsNameAndKindWhichAWindowNamesANewTabBy(): void {
    const json: object = { sessionId: "s1", shellId: "pwsh", folder: "/work", title: "", exit: null, isAgentTerminal: false,
      isPanelTerminal: false, owner: null, opensTab: true, name: null, shellName: "PowerShell 7", shellKind: "PowerShell" };

    Expect.same(["PowerShell 7", "PowerShell"], [TerminalSummary.fromJson(json).shellName, TerminalSummary.fromJson(json).shellKind]);
    Expect.same(json, new TerminalSummary("s1", "pwsh", "/work", "", null, false, false, null, true, null, "PowerShell 7", TerminalShellKind.PowerShell).toJson());
    Expect.throwsMatching(() => new TerminalSummary("s1", "pwsh", "/work", "", null, false, false, null, true, null, " ", TerminalShellKind.PowerShell), { name: "ArgumentException", parameterName: "shellName" });
    Expect.throwsMatching(() => TerminalSummary.fromJson({ ...json, shellKind: "Tcsh" }), { name: "JsonException", path: "$.shellKind" });
    Expect.throwsMatching(() => TerminalSummary.fromJson({ ...json, shellName: undefined }), { name: "JsonException", path: "$.shellName" });
  }

  @TestMethod
  public refusesABlankShellIdOrFolderAndAnUnknownField(): void {
    Assert.throws(() => new TerminalSummary("s1", "", "/work", "", null, false, false, null, true, null, null, TerminalShellKind.Other), ArgumentException);
    Assert.throws(() => new TerminalSummary("s1", "bash", " ", "", null, false, false, null, true, null, null, TerminalShellKind.Other), ArgumentException);
    Expect.throwsMatching(() => TerminalSummary.fromJson({ sessionId: "s1", shellId: "bash", folder: "/work", title: "", exit: null, isAgentTerminal: false,
        isPanelTerminal: false, owner: null, opensTab: true, name: null, shellName: null, shellKind: "Other", cwd: "/" }), { name: "JsonException", path: "$.cwd" });
  }

  @TestMethod
  public refusesABlankSessionAndAFolderOrTitleLongerThanItsLimit(): void {
    for (const sessionId of ["", " "])
      Expect.throwsMatching(() => new TerminalSummary(sessionId, "bash", "/work", "", null, false, false, null, true, null, null, TerminalShellKind.Other), { name: "ArgumentException", parameterName: "sessionId" });
    Expect.throwsMatching(() => new TerminalSummary("s1", "bash", "/".repeat(4_097), "", null, false, false, null, true, null, null, TerminalShellKind.Other), { name: "ArgumentException", parameterName: "folder" });
    Expect.throwsMatching(() => new TerminalSummary("s1", "bash", "/work", "t".repeat(4_097), null, false, false, null, true, null, null, TerminalShellKind.Other), { name: "ArgumentException", parameterName: "title" });
  }
}
