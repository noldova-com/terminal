/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { PermissionDecision, type ToolFailure, ToolFailureCode, type ToolResult } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { TerminalWriteTool } from "../../../src/tools/services/terminal-write-tool.ts";
import type { FakeAgentTerminal } from "../../fixtures/fake-agent-terminals.fixture.ts";
import { FakeTerminalPrompt } from "../../fixtures/fake-agent-terminals.fixture.ts";
import { ToolHarness } from "../../fixtures/tool-harness.fixture.ts";

function createTool(harness: ToolHarness): TerminalWriteTool {
  return new TerminalWriteTool(harness.accessPolicy, harness.gate);
}

describe("TerminalWriteTool", () => {
  it("describes a high-risk, non-resumable tool, one call per terminal, that sends terminal_read after an uncertain end", () => {
    const tool: TerminalWriteTool = createTool(new ToolHarness());

    assert.deepEqual(
      [tool.descriptor.name, tool.descriptor.risk, tool.descriptor.hints?.isOpenWorld, tool.descriptor.isResumable, tool.descriptor.marksSending, tool.descriptor.resource,
        tool.descriptor.nextTool],
      ["terminal_write", { default: "High", maximum: "High" }, true, false, true, "/terminal_id", "terminal_read"]);
    assert.deepEqual(tool.descriptor.inputSchema["required"], ["terminal_id", "keys"]);
  });

  it("asks as terminal.write with the exact keys shown escaped, offering no allow always, then sends only those keys and returns the title as untrusted", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
    terminal.prompt = new FakeTerminalPrompt(false, "/work/project");
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);

    const result: ToolResult = await createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", keys: "y\r", explanation: "Confirms the prompt." }));

    assert.deepEqual(harness.permissions.requests, [{
      action: "terminal.write",
      subject: "sha256:007a5ddcb9bf61ce6f9e2d4c3a4dd92eb4ea38b6000225eab1304dd6930d4763",
      title: "Send keys to a terminal",
      details: [
        { label: "Terminal", kind: "Text", value: "bash - project" },
        { label: "Terminal id", kind: "Code", value: "t1" },
        { label: "Shared by you", kind: "Text", value: "No" },
        { label: "Shell", kind: "Text", value: "bash" },
        { label: "Shell program", kind: "Code", value: "/bin/bash" },
        { label: "Working folder", kind: "Code", value: "/work/project" },
        { label: "Inside the session's working folder", kind: "Text", value: "Yes" },
        { label: "At an empty prompt", kind: "Text", value: "No" },
        { label: "Keys", kind: "Code", value: "y\\r" },
        { label: "Holds characters that hide or reorder text, shown escaped", kind: "Text", value: "No" },
        { label: "Why", kind: "AgentText", value: "Confirms the prompt." }
      ],
      risk: "High",
      isAsking: true,
      options: ["AllowOnce", "Deny"]
    }]);
    assert.deepEqual(terminal.writes, ["y\r"]);
    assert.deepEqual(result.structured, { terminal_id: "t1", title: "bash - project" });
    assert.equal(ToolHarness.textOf(result), "Sent the keys to terminal t1. terminal_read returns what follows.");
    assert.equal(ToolHarness.originOf(result), "terminal:t1");
  });

  it("says an unknown folder isn't inside the working folder", async () => {
    const harness: ToolHarness = new ToolHarness();
    harness.terminals.add("t1", "session-1").prompt = new FakeTerminalPrompt(true, null);
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);
    await createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", keys: "q" }));

    assert.equal(harness.permissions.detail(0, "Inside the session's working folder"), "No");
  });

  it("refuses to type into a password prompt, which is the person's to answer", async () => {
    const harness: ToolHarness = new ToolHarness();
    harness.terminals.add("t1", "session-1").isAwaitingSecret = true;

    await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", keys: "hunter2\r" })), ToolFailureCode.Refused, "terminal.awaitingSecret");
    assert.equal(harness.permissions.requests.length, 0);
  });

  it("refuses keys that would join a line the person is typing", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
    terminal.hasPendingLine = true;

    const failure: ToolFailure = await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", keys: "make\r" })),
      ToolFailureCode.Unavailable, "terminal.lineInUse");
    assert.match(failure.message, /^Terminal t1 has text on its line/);
    assert.deepEqual([harness.permissions.requests.length, terminal.writes], [0, []]);
  });

  for (const [outcome, code] of [[PermissionDecision.Denied, ToolFailureCode.Denied], [PermissionDecision.DeniedAlways, ToolFailureCode.Denied],
    [PermissionDecision.Expired, ToolFailureCode.Expired], [PermissionDecision.Withdrawn, ToolFailureCode.Withdrawn]] as const) {
    it(`sends nothing when the request ends as ${outcome}`, async () => {
      const harness: ToolHarness = new ToolHarness();
      const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
      harness.permissions.answerNext(outcome);

      await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", keys: "q" })), code, null);
      assert.deepEqual(terminal.writes, []);
    });
  }

  it("sends nothing when the terminal changed after the grant", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);
    harness.permissions.whenRaised(() => {
      terminal.prompt = new FakeTerminalPrompt(false, "/work/project");
    });

    await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", keys: "q" })), ToolFailureCode.Stale, "terminal.stale");
    assert.deepEqual(terminal.writes, []);
  });

  it("refuses an ended terminal and one the session may not use", async () => {
    const harness: ToolHarness = new ToolHarness();
    harness.terminals.add("ended", "session-1").isRunning = false;
    harness.terminals.add("persons", null);

    await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({ terminal_id: "ended", keys: "q" })), ToolFailureCode.Unavailable, "terminal.ended");
    await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({ terminal_id: "persons", keys: "q" })), ToolFailureCode.Refused, "terminal.notFound");
  });
});
