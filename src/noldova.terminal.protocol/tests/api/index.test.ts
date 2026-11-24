/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import * as api from "../../src/api/index.ts";

@TestClass
export class TerminalProtocolApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    const exportNames: readonly string[] = [
      "ArgumentProblem", "ArgumentValidator", "EndedBy", "PackageCopiesException", "ProtocolReader", "Resources", "RuntimeTerminalOwners", "TerminalAckParams",
      "TerminalAttachment", "TerminalCommandAdded", "TerminalCommandEnded", "TerminalCompleteParams", "TerminalCompletion", "TerminalCompletionItem",
      "TerminalCompletionKind", "TerminalCwd", "TerminalExit", "TerminalExited", "TerminalFindCommandsParams", "TerminalInputEdge", "TerminalInputMark",
      "TerminalInputParams", "TerminalInputStart", "TerminalLaunchParams", "TerminalLaunched", "TerminalLine", "TerminalLinePage", "TerminalLineRange",
      "TerminalLinesParams", "TerminalMissingCommands", "TerminalName", "TerminalNames", "TerminalOpenParams", "TerminalOutput", "TerminalOwnerReference",
      "TerminalPaneReference", "TerminalProtocolException", "TerminalReference", "TerminalResizeParams", "TerminalRestartParams", "TerminalRestoreParams",
      "TerminalRunBusy", "TerminalRunEnded", "TerminalRunEndedBy", "TerminalRunOutcome", "TerminalRunOutput", "TerminalRunOutputParams", "TerminalRunParams",
      "TerminalRunResult", "TerminalSessions", "TerminalShell", "TerminalShellKind", "TerminalShells", "TerminalShowOwnerParams", "TerminalSize",
      "TerminalSummary", "TerminalTextRun", "TerminalTextStyle", "TerminalTitle", "TerminalVisibilityParams", "WindowsPty"
    ];

    Assert.areEqual([...exportNames].sort().join(","), Object.keys(api).sort().join(","));
  }
}
