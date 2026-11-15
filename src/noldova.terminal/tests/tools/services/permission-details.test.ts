/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { type IPermissionDetail, PermissionDetailKind } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { AgentTerminalAccess } from "../../../src/tools/models/agent-terminal-access.ts";
import { PermissionDetails } from "../../../src/tools/services/permission-details.ts";
import { FakeAgentTerminal } from "../../fixtures/fake-agent-terminals.fixture.ts";

describe("PermissionDetails", () => {
  it("makes a text, a code and a yes or no detail", () => {
    const details: readonly IPermissionDetail[] = [
      PermissionDetails.text("Shell", "bash"),
      PermissionDetails.code("Command", "ls"),
      PermissionDetails.yesNo("Shared by you", true),
      PermissionDetails.yesNo("Shared by you", false)
    ];

    assert.deepEqual(details, [
      { label: "Shell", kind: PermissionDetailKind.Text, value: "bash" },
      { label: "Command", kind: PermissionDetailKind.Code, value: "ls" },
      { label: "Shared by you", kind: PermissionDetailKind.Text, value: "Yes" },
      { label: "Shared by you", kind: PermissionDetailKind.Text, value: "No" }
    ]);
  });

  it("names a terminal by its title with unseen characters escaped, its id and whether the person shared it", () => {
    const terminal: FakeAgentTerminal = new FakeAgentTerminal("t1", "s1");
    terminal.title = "bash\u0007\u202E - project";

    assert.deepEqual(PermissionDetails.forTerminal(new AgentTerminalAccess(terminal, true)), [
      { label: "Terminal", kind: PermissionDetailKind.Text, value: "bash\\u{0007}\\u{202E} - project" },
      { label: "Terminal id", kind: PermissionDetailKind.Code, value: "t1" },
      { label: "Shared by you", kind: PermissionDetailKind.Text, value: "Yes" }
    ]);
  });

  it("names a terminal's shell and its program", () => {
    const terminal: FakeAgentTerminal = new FakeAgentTerminal("t1", "s1");

    assert.deepEqual(PermissionDetails.forShell(new AgentTerminalAccess(terminal, false)), [
      { label: "Shell", kind: PermissionDetailKind.Text, value: "bash" },
      { label: "Shell program", kind: PermissionDetailKind.Code, value: "/bin/bash" }
    ]);
  });

  it("names a folder with unseen characters escaped, and whether it is inside the session's working folder", () => {
    assert.deepEqual(PermissionDetails.forFolder("/work/\u202Eproject", true), [
      { label: "Working folder", kind: PermissionDetailKind.Code, value: "/work/\\u{202E}project" },
      { label: "Inside the session's working folder", kind: PermissionDetailKind.Text, value: "Yes" }
    ]);
  });

  it("says a folder the shell hasn't reported is unknown", () => {
    assert.deepEqual(PermissionDetails.forFolder(null, false), [
      { label: "Working folder", kind: PermissionDetailKind.Text, value: "Unknown: the shell hasn't reported it" },
      { label: "Inside the session's working folder", kind: PermissionDetailKind.Text, value: "No" }
    ]);
  });

  it("shows the agent's explanation as agent text, and nothing without one", () => {
    assert.deepEqual(PermissionDetails.forExplanation("To build the project."), [
      { label: "Why", kind: PermissionDetailKind.AgentText, value: "To build the project." }
    ]);
    assert.deepEqual(PermissionDetails.forExplanation(null), []);
  });
});
