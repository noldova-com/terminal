/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { PermissionDecision, ToolAbortReason, ToolFailureCode, type ToolResult } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { ReadCursor } from "../../../src/tools/models/read-cursor.ts";
import { TerminalCloseTool } from "../../../src/tools/services/terminal-close-tool.ts";
import type { FakeAgentTerminal } from "../../fixtures/fake-agent-terminals.fixture.ts";
import { ToolHarness } from "../../fixtures/tool-harness.fixture.ts";

function createTool(harness: ToolHarness): TerminalCloseTool {
  return new TerminalCloseTool(harness.accessPolicy, harness.gate, harness.cursors);
}

describe("TerminalCloseTool", () => {
  it("describes a medium-risk, destructive, non-resumable tool, one call per terminal, that sends terminal_list after an uncertain end", () => {
    const tool: TerminalCloseTool = createTool(new ToolHarness());

    assert.deepEqual(
      [tool.descriptor.name, tool.descriptor.risk, tool.descriptor.hints?.isDestructive, tool.descriptor.isResumable, tool.descriptor.resource, tool.descriptor.nextTool],
      ["terminal_close", { default: "Medium", maximum: "Medium" }, true, false, "/terminal_id", "terminal_list"]);
  });

  it("asks as terminal.close, then closes the terminal and forgets its read position", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
    harness.cursors.set("session-1", "t1", ReadCursor.forTerminal(terminal, 3));
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);

    const result: ToolResult = await createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", explanation: "Done with it." }));

    assert.deepEqual(harness.permissions.requests, [{
      action: "terminal.close",
      subject: "[\"t1\"]",
      title: "Close a terminal and end its shell",
      details: [
        { label: "Terminal", kind: "Text", value: "bash - project" },
        { label: "Terminal id", kind: "Code", value: "t1" },
        { label: "Shared by you", kind: "Text", value: "No" },
        { label: "Why", kind: "AgentText", value: "Done with it." }
      ],
      risk: "Medium",
      isAsking: true,
      options: ["AllowOnce", "AllowAlways", "Deny"]
    }]);
    assert.equal(terminal.closes, 1);
    assert.equal(harness.cursors.find("session-1", "t1"), undefined);
    assert.equal(ToolHarness.textOf(result), "Closed terminal t1.");
    assert.deepEqual(result.structured, { terminal_id: "t1" });
  });

  it("closes nothing when the request is denied", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
    harness.permissions.answerNext(PermissionDecision.Expired);

    await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1" })), ToolFailureCode.Expired, null);
    assert.equal(terminal.closes, 0);
  });

  it("reports an uncertain outcome when the call ends while the terminal closes, and keeps its read position", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
    const controller: AbortController = new AbortController();
    harness.cursors.set("session-1", "t1", ReadCursor.forTerminal(terminal, 3));
    terminal.onClosing = () => controller.abort(ToolAbortReason.Cancelled);
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);

    await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1" }, controller.signal)), ToolFailureCode.OutcomeUncertain, "terminal.outcomeUncertain");
    assert.equal(terminal.closes, 1);
    assert.equal(harness.cursors.find("session-1", "t1")?.offset, 3);
  });
});
