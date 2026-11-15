/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { PermissionDecision, ToolAbortReason, type ToolFailure, ToolFailureCode, type ToolResult } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { TerminalReadTool } from "../../../src/tools/services/terminal-read-tool.ts";
import { TerminalRunTool } from "../../../src/tools/services/terminal-run-tool.ts";
import type { FakeAgentTerminal } from "../../fixtures/fake-agent-terminals.fixture.ts";
import { ToolHarness } from "../../fixtures/tool-harness.fixture.ts";

function createTool(harness: ToolHarness): TerminalReadTool {
  return new TerminalReadTool(harness.accessPolicy, harness.gate, harness.cursors);
}

describe("TerminalReadTool", () => {
  it("describes a read-only, resumable tool whose risk rises for a shared terminal", () => {
    const tool: TerminalReadTool = createTool(new ToolHarness());

    assert.deepEqual(
      [tool.descriptor.name, tool.descriptor.risk, tool.descriptor.hints?.isReadOnly, tool.descriptor.isResumable, tool.descriptor.marksSending],
      ["terminal_read", { default: "Low", maximum: "Medium" }, true, true, false]);
  });

  it("returns the rest of a command that terminal_run left running, then only what is new", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
    terminal.nextCommand.output = "step 1\n";
    harness.permissions.answerNext(PermissionDecision.AllowedOnce, PermissionDecision.AllowedOnce, PermissionDecision.AllowedOnce);
    await new TerminalRunTool(harness.accessPolicy, harness.gate, harness.cursors).handleAsync(harness.createCall({ terminal_id: "t1", command: "make" }));
    terminal.nextCommand.output += "step 2\n";
    terminal.nextCommand.finish(0, "/work/project");

    const first: ToolResult = await createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", wait_ms: 5_000 }));
    const second: ToolResult = await createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1" }));

    assert.equal(first.structured?.["output"], "step 2\n");
    assert.equal(first.structured?.["status"], "Exited");
    assert.equal(first.structured?.["exit_code"], 0);
    assert.equal(first.structured?.["cwd"], "/work/project");
    assert.deepEqual(terminal.nextCommand.outputWaits.map(t => [t.offset, t.timeoutMilliseconds]), [[7, 5_000], [14, 0]]);
    assert.equal(second.structured?.["output"], "");
    assert.deepEqual([harness.permissions.requests[1]?.action, harness.permissions.requests[1]?.risk, harness.permissions.requests[1]?.isAsking],
      ["terminal.read", "Low", false]);
  });

  it("reads a shared terminal's own output at medium risk, from its start", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("shared", null);
    terminal.output = "$ ls\nREADME.md\n";
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);

    const result: ToolResult = await createTool(harness).handleAsync(harness.createCall({ terminal_id: "shared", max_chars: 30_000 }, undefined, ["shared"]));

    assert.deepEqual(harness.permissions.requests, [{
      action: "terminal.read",
      subject: "[\"shared\"]",
      title: "Read a terminal's output",
      details: [
        { label: "Terminal", kind: "Text", value: "bash - project" },
        { label: "Terminal id", kind: "Code", value: "shared" },
        { label: "Shared by you", kind: "Text", value: "Yes" }
      ],
      risk: "Medium",
      isAsking: true,
      options: ["AllowOnce", "AllowAlways", "Deny"]
    }]);
    assert.equal(result.structured?.["output"], "$ ls\nREADME.md\n");
    assert.equal(result.structured?.["status"], null);
    assert.equal(result.structured?.["cwd"], "/work/project");
    assert.equal(ToolHarness.originOf(result), "terminal:shared");
    assert.equal(harness.cursors.find("session-1", "shared")?.offset, 15);
  });

  it("reads nothing when the request is denied", async () => {
    const harness: ToolHarness = new ToolHarness();
    harness.terminals.add("t1", "session-1").output = "secret";
    harness.permissions.answerNext(PermissionDecision.Denied);

    await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1" })), ToolFailureCode.Denied, null);
    assert.equal(harness.cursors.find("session-1", "t1"), undefined);
  });

  it("fails with what ended the call and the output so far, and keeps its place, when the call ends during the wait", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
    const controller: AbortController = new AbortController();
    terminal.output = "abc";
    terminal.onWait = () => controller.abort(ToolAbortReason.Cancelled);
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);

    const failure: ToolFailure = await ToolHarness.assertFailsAsync(
      createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", wait_ms: 1_000 }, controller.signal)), ToolFailureCode.Cancelled, null);

    assert.equal(failure.message, "terminal_read ended before it finished; the output so far follows.");
    assert.equal(ToolHarness.textOf(failure).slice(0, 3), "abc");
    assert.equal(ToolHarness.originOf(failure), "terminal:t1");
    assert.equal(harness.cursors.find("session-1", "t1"), undefined);
  });

  for (const [reason, interrupts, code] of [
    [ToolAbortReason.Stopped, 1, ToolFailureCode.Stopped],
    [ToolAbortReason.SessionEnded, 1, ToolFailureCode.Cancelled],
    [ToolAbortReason.DeadlineReached, 0, ToolFailureCode.TimedOut],
    [ToolAbortReason.SwitchedOff, 0, ToolFailureCode.Unavailable]
  ] as const)
    it(`${interrupts === 1 ? "interrupts" : "leaves running"} the command its run started when the call ends as ${reason}, failing as ${code}`, async () => {
      const harness: ToolHarness = new ToolHarness();
      const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
      const controller: AbortController = new AbortController();
      terminal.nextCommand.output = "step 1\n";
      harness.permissions.answerNext(PermissionDecision.AllowedOnce, PermissionDecision.AllowedOnce);
      await new TerminalRunTool(harness.accessPolicy, harness.gate, harness.cursors).handleAsync(harness.createCall({ terminal_id: "t1", command: "make" }));
      terminal.nextCommand.onWait = () => controller.abort(reason);

      const failure: ToolFailure = await ToolHarness.assertFailsAsync(
        createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", wait_ms: 1_000 }, controller.signal)), code, null);

      assert.equal(terminal.nextCommand.interrupts, interrupts);
      assert.equal(failure.message.includes("was interrupted"), interrupts === 1);
      assert.equal(ToolHarness.textOf(failure).endsWith("\n[The command was interrupted because the call ended.]"), interrupts === 1);
    });

  it("refuses a terminal the session may not use", async () => {
    const harness: ToolHarness = new ToolHarness();
    harness.terminals.add("others", "session-2");

    await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({ terminal_id: "others" })), ToolFailureCode.Refused, "terminal.notFound");
  });
});
