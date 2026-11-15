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
import { TerminalSessions } from "../../src/models/terminal-sessions.ts";
import { TerminalSummary } from "../../src/models/terminal-summary.ts";

describe("TerminalSessions", () => {
  it("writes and reads its sessions in order", () => {
    const json: object = {
      sessions: [
        { sessionId: "s1", shellId: "bash", folder: "/work", title: "", exit: null, isAgentTerminal: false, isPanelTerminal: true, owner: null, opensTab: true, name: null, shellName: null, shellKind: "Other" },
        { sessionId: "s2", shellId: "zsh", folder: "/work", title: "", exit: null, isAgentTerminal: true, isPanelTerminal: false, owner: null, opensTab: true, name: null, shellName: null, shellKind: "Other" }
      ]
    };

    assert.deepEqual(TerminalSessions.fromJson(json).sessions.map(t => t.sessionId), ["s1", "s2"]);
    assert.deepEqual(
      new TerminalSessions([
        new TerminalSummary("s1", "bash", "/work", "", null, false, true, null, true, null, null, TerminalShellKind.Other),
        new TerminalSummary("s2", "zsh", "/work", "", null, true, false, null, true, null, null, TerminalShellKind.Other)
      ]).toJson(),
      json);
  });

  it("keeps its own copy of the sessions", () => {
    const sessions: TerminalSummary[] = [];
    const answer: TerminalSessions = new TerminalSessions(sessions);
    sessions.push(new TerminalSummary("s1", "bash", "/work", "", null, false, true, null, true, null, null, TerminalShellKind.Other));

    assert.deepEqual(answer.sessions, []);
  });

  it("writes and reads no sessions", () => {
    assert.deepEqual(TerminalSessions.fromJson({ sessions: [] }).sessions, []);
  });

  it("names the session it cannot read", () => {
    assert.throws(() => TerminalSessions.fromJson({ sessions: [null] }), { name: "JsonException", path: "$.sessions.0" });
  });
});
