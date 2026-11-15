/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { PermissionDecision, ToolFailureCode, type ToolResult } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { TerminalInterruptTool } from "../../../src/tools/services/terminal-interrupt-tool.ts";
import type { FakeAgentTerminal } from "../../fixtures/fake-agent-terminals.fixture.ts";
import { FakeTerminalPrompt } from "../../fixtures/fake-agent-terminals.fixture.ts";
import { ToolHarness } from "../../fixtures/tool-harness.fixture.ts";

function createTool(harness: ToolHarness): TerminalInterruptTool {
  return new TerminalInterruptTool(harness.accessPolicy, harness.gate);
}

describe("TerminalInterruptTool", () => {
  it("describes a medium-risk, destructive, non-resumable tool, one call per terminal, that sends terminal_read after an uncertain end", () => {
    const tool: TerminalInterruptTool = createTool(new ToolHarness());

    assert.deepEqual(
      [tool.descriptor.name, tool.descriptor.risk, tool.descriptor.hints?.isDestructive, tool.descriptor.isResumable, tool.descriptor.resource, tool.descriptor.nextTool],
      ["terminal_interrupt", { default: "Medium", maximum: "Medium" }, true, false, "/terminal_id", "terminal_read"]);
    assert.deepEqual(tool.descriptor.inputSchema["required"], ["terminal_id"]);
  });

  it("asks as terminal.interrupt, then interrupts the terminal it showed", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("shared", null);
    terminal.prompt = new FakeTerminalPrompt(false, "/work/project");
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);

    const result: ToolResult = await createTool(harness).handleAsync(harness.createCall({ terminal_id: "shared", explanation: "It hangs." }, undefined, ["shared"]));

    assert.deepEqual(harness.permissions.requests, [{
      action: "terminal.interrupt",
      subject: "[\"shared\"]",
      title: "Interrupt the program running in a terminal",
      details: [
        { label: "Terminal", kind: "Text", value: "bash - project" },
        { label: "Terminal id", kind: "Code", value: "shared" },
        { label: "Shared by you", kind: "Text", value: "Yes" },
        { label: "Working folder", kind: "Code", value: "/work/project" },
        { label: "Inside the session's working folder", kind: "Text", value: "Yes" },
        { label: "Why", kind: "AgentText", value: "It hangs." }
      ],
      risk: "Medium",
      isAsking: true,
      options: ["AllowOnce", "AllowAlways", "Deny"]
    }]);
    assert.equal(terminal.interrupts, 1);
    assert.deepEqual(result.structured, { terminal_id: "shared" });
    assert.equal(ToolHarness.textOf(result), "Sent an interrupt to terminal shared.");
  });

  it("interrupts nothing when the request is denied or the terminal changed", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
    harness.permissions.answerNext(PermissionDecision.Denied);
    await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1" })), ToolFailureCode.Denied, null);

    harness.permissions.answerNext(PermissionDecision.AllowedOnce);
    harness.permissions.whenRaised(() => {
      terminal.prompt = new FakeTerminalPrompt(false, "/work/project");
    });
    await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1" })), ToolFailureCode.Stale, "terminal.stale");
    assert.equal(terminal.interrupts, 0);
  });

  it("refuses an ended terminal", async () => {
    const harness: ToolHarness = new ToolHarness();
    harness.terminals.add("t1", "session-1").isRunning = false;

    await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1" })), ToolFailureCode.Unavailable, "terminal.ended");
  });
});
