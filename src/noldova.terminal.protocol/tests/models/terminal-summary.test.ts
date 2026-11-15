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

import { EndedBy } from "../../src/enums/ended-by.ts";
import { TerminalShellKind } from "../../src/enums/terminal-shell-kind.ts";
import { TerminalExit } from "../../src/models/terminal-exit.ts";
import { TerminalSummary } from "../../src/models/terminal-summary.ts";

describe("TerminalSummary", () => {
  it("writes and reads a running terminal", () => {
    const json: object = { sessionId: "s1", shellId: "bash", folder: "/work", title: "~", exit: null, isAgentTerminal: false,
      isPanelTerminal: true, owner: null, opensTab: true, name: null, shellName: null, shellKind: "Other" };

    assert.deepEqual(TerminalSummary.fromJson(json).toJson(), json);
    assert.equal(TerminalSummary.fromJson(json).exit, null);
    assert.equal(TerminalSummary.fromJson(json).isPanelTerminal, true);
  });

  it("writes and reads an ended agent terminal", () => {
    const summary: TerminalSummary = new TerminalSummary("s1", "bash", "/work", "", new TerminalExit(0, EndedBy.Exit), true, false, null, true, null, null,
      TerminalShellKind.Other);

    assert.deepEqual(summary.toJson(), {
      sessionId: "s1",
      shellId: "bash",
      folder: "/work",
      title: "",
      exit: { exitCode: 0, endedBy: "Exit" },
      isAgentTerminal: true,
      isPanelTerminal: false,
      owner: null, opensTab: true, name: null, shellName: null, shellKind: "Other"
    });
    assert.equal(TerminalSummary.fromJson(summary.toJson()).exit?.exitCode, 0);
    assert.equal(TerminalSummary.fromJson(summary.toJson()).isAgentTerminal, true);
  });

  it("writes and reads its owner", () => {
    const json: object = { sessionId: "s1", shellId: "bash", folder: "/work", title: "", exit: null, isAgentTerminal: false,
      isPanelTerminal: false, owner: "example.chat/42", opensTab: true, name: null, shellName: null, shellKind: "Other" };

    assert.equal(TerminalSummary.fromJson(json).owner, "example.chat/42");
    assert.deepEqual(new TerminalSummary("s1", "bash", "/work", "", null, false, false, "example.chat/42", true, null, null, TerminalShellKind.Other).toJson(), json);
    assert.throws(() => new TerminalSummary("s1", "bash", "/work", "", null, false, false, " ", true, null, null, TerminalShellKind.Other),
      { name: "ArgumentException", parameterName: "owner" });
    assert.throws(() => TerminalSummary.fromJson({ ...json, owner: undefined }), { name: "JsonException", path: "$.owner" });
  });

  it("writes and reads the person's name for it", () => {
    const json: object = { sessionId: "s1", shellId: "bash", folder: "/work", title: "vim", exit: null, isAgentTerminal: false,
      isPanelTerminal: false, owner: null, opensTab: true, name: "Server", shellName: null, shellKind: "Other" };

    assert.equal(TerminalSummary.fromJson(json).name, "Server");
    assert.deepEqual(new TerminalSummary("s1", "bash", "/work", "vim", null, false, false, null, true, "Server", null, TerminalShellKind.Other).toJson(), json);
    assert.throws(() => new TerminalSummary("s1", "bash", "/work", "", null, false, false, null, true, " ", null, TerminalShellKind.Other),
      { name: "ArgumentException", parameterName: "name" });
    assert.throws(() => TerminalSummary.fromJson({ ...json, name: undefined }), { name: "JsonException", path: "$.name" });
  });

  it("writes and reads its shell's name and kind, which a window names a new tab by", () => {
    const json: object = { sessionId: "s1", shellId: "pwsh", folder: "/work", title: "", exit: null, isAgentTerminal: false,
      isPanelTerminal: false, owner: null, opensTab: true, name: null, shellName: "PowerShell 7", shellKind: "PowerShell" };

    assert.deepEqual([TerminalSummary.fromJson(json).shellName, TerminalSummary.fromJson(json).shellKind], ["PowerShell 7", "PowerShell"]);
    assert.deepEqual(new TerminalSummary("s1", "pwsh", "/work", "", null, false, false, null, true, null, "PowerShell 7", TerminalShellKind.PowerShell).toJson(),
      json);
    assert.throws(() => new TerminalSummary("s1", "pwsh", "/work", "", null, false, false, null, true, null, " ", TerminalShellKind.PowerShell),
      { name: "ArgumentException", parameterName: "shellName" });
    assert.throws(() => TerminalSummary.fromJson({ ...json, shellKind: "Tcsh" }), { name: "JsonException", path: "$.shellKind" });
    assert.throws(() => TerminalSummary.fromJson({ ...json, shellName: undefined }), { name: "JsonException", path: "$.shellName" });
  });

  it("refuses a blank shell id or folder, and an unknown field", () => {
    assert.throws(() => new TerminalSummary("s1", "", "/work", "", null, false, false, null, true, null, null, TerminalShellKind.Other), ArgumentException);
    assert.throws(() => new TerminalSummary("s1", "bash", " ", "", null, false, false, null, true, null, null, TerminalShellKind.Other), ArgumentException);
    assert.throws(
      () => TerminalSummary.fromJson({ sessionId: "s1", shellId: "bash", folder: "/work", title: "", exit: null, isAgentTerminal: false,
        isPanelTerminal: false, owner: null, opensTab: true, name: null, shellName: null, shellKind: "Other", cwd: "/" }),
      { name: "JsonException", path: "$.cwd" });
  });

  it("refuses a blank session, and a folder or title longer than its limit", () => {
    for (const sessionId of ["", " "])
      assert.throws(() => new TerminalSummary(sessionId, "bash", "/work", "", null, false, false, null, true, null, null, TerminalShellKind.Other),
        { name: "ArgumentException", parameterName: "sessionId" });
    assert.throws(() => new TerminalSummary("s1", "bash", "/".repeat(4_097), "", null, false, false, null, true, null, null, TerminalShellKind.Other),
      { name: "ArgumentException", parameterName: "folder" });
    assert.throws(() => new TerminalSummary("s1", "bash", "/work", "t".repeat(4_097), null, false, false, null, true, null, null, TerminalShellKind.Other),
      { name: "ArgumentException", parameterName: "title" });
  });
});
