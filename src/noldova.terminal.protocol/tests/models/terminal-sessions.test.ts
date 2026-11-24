/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalShellKind } from "../../src/enums/terminal-shell-kind.ts";
import { TerminalSessions } from "../../src/models/terminal-sessions.ts";
import { TerminalSummary } from "../../src/models/terminal-summary.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalSessionsTests {
  @TestMethod
  public writesAndReadsItsSessionsInOrder(): void {
    const json: object = {
      sessions: [
        { sessionId: "s1", shellId: "bash", folder: "/work", title: "", exit: null, isAgentTerminal: false, isPanelTerminal: true, owner: null, opensTab: true, name: null, shellName: null, shellKind: "Other" },
        { sessionId: "s2", shellId: "zsh", folder: "/work", title: "", exit: null, isAgentTerminal: true, isPanelTerminal: false, owner: null, opensTab: true, name: null, shellName: null, shellKind: "Other" }
      ]
    };

    Expect.same(["s1", "s2"], TerminalSessions.fromJson(json).sessions.map(t => t.sessionId));
    Expect.same(json, new TerminalSessions([
        new TerminalSummary("s1", "bash", "/work", "", null, false, true, null, true, null, null, TerminalShellKind.Other),
        new TerminalSummary("s2", "zsh", "/work", "", null, true, false, null, true, null, null, TerminalShellKind.Other)
      ]).toJson());
  }

  @TestMethod
  public keepsItsOwnCopyOfTheSessions(): void {
    const sessions: TerminalSummary[] = [];
    const answer: TerminalSessions = new TerminalSessions(sessions);
    sessions.push(new TerminalSummary("s1", "bash", "/work", "", null, false, true, null, true, null, null, TerminalShellKind.Other));

    Expect.same([], answer.sessions);
  }

  @TestMethod
  public writesAndReadsNoSessions(): void {
    Expect.same([], TerminalSessions.fromJson({ sessions: [] }).sessions);
  }

  @TestMethod
  public namesTheSessionItCannotRead(): void {
    Expect.throwsMatching(() => TerminalSessions.fromJson({ sessions: [null] }), { name: "JsonException", path: "$.sessions.0" });
  }
}
