/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import type { JsonObject } from "@noldova/context.json";
import { PermissionDecision, ToolAbortReason, ToolCall, ToolFailureCode, type ToolResult } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { TerminalOpenTool } from "../../../src/tools/services/terminal-open-tool.ts";
import { createBindings, createCall, SCOPE, SESSION_ID } from "../../fixtures/tool-call-contexts.fixture.ts";
import { ToolHarness } from "../../fixtures/tool-harness.fixture.ts";

function createTool(harness: ToolHarness): TerminalOpenTool {
  return new TerminalOpenTool(harness.terminals, harness.gate);
}

describe("TerminalOpenTool", () => {
  it("describes a medium-risk, non-resumable tool, with calls in parallel, that sends terminal_list after an uncertain end", () => {
    const tool: TerminalOpenTool = createTool(new ToolHarness());

    assert.deepEqual(
      [tool.descriptor.name, tool.descriptor.risk, tool.descriptor.isResumable, tool.descriptor.marksSending, tool.descriptor.resource, tool.descriptor.nextTool],
      ["terminal_open", { default: "Medium", maximum: "Medium" }, false, true, undefined, "terminal_list"]);
  });

  it("asks as terminal.open with the shell, the folder and the agent's words, then opens a terminal the session owns in its working folder", async () => {
    const harness: ToolHarness = new ToolHarness();
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);

    const call: ToolCall = harness.createCall({ shell: "zsh", explanation: "Needs a shell." });
    const result: ToolResult = await createTool(harness).handleAsync(call);

    assert.deepEqual(harness.permissions.requests, [{
      action: "terminal.open",
      subject: "[\"zsh\"]",
      title: "Open a terminal",
      details: [
        { label: "Shell", kind: "Text", value: "zsh" },
        { label: "Working folder", kind: "Code", value: "/work/project" },
        { label: "Inside the session's working folder", kind: "Text", value: "Yes" },
        { label: "Why", kind: "AgentText", value: "Needs a shell." }
      ],
      risk: "Medium",
      isAsking: true,
      options: ["AllowOnce", "AllowAlways", "Deny"]
    }]);
    assert.equal(harness.terminals.openings.length, 1);
    assert.equal(harness.terminals.openings[0]?.ownerSessionId, "session-1");
    assert.equal(harness.terminals.openSignals[0], call.signal);
    assert.equal(harness.terminals.openings[0]?.shellId, "zsh");
    assert.equal(harness.terminals.openings[0]?.cwd, "/work/project");
    assert.deepEqual(result.structured, {
      terminal_id: "opened-1",
      title: "bash - project",
      name: null,
      shell_name: "Bash",
      shell: "bash",
      cwd: "/work/project",
      has_shell_integration: true
    });
    assert.equal(ToolHarness.textOf(result), "Opened terminal opened-1, running bash in /work/project.");
    assert.equal(ToolHarness.originOf(result), "terminal:opened-1");
  });

  it("opens the terminal with the owner the session's terminal.owner binding names, and refuses a blank one before asking", async () => {
    const harness: ToolHarness = new ToolHarness();
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);
    const bindings: JsonObject = { ...createBindings(), "terminal.owner": "example.chat/42" };

    await createTool(harness).handleAsync(new ToolCall(SESSION_ID, SCOPE, bindings, {}, Date.now() + 30_000, new AbortController().signal, harness.permissions));
    const blank: ToolCall = new ToolCall(SESSION_ID, SCOPE, { ...bindings, "terminal.owner": " " }, {}, Date.now() + 30_000, new AbortController().signal,
      harness.permissions);

    assert.deepEqual([harness.terminals.openings[0]?.owner, harness.terminals.terminals[0]?.owner], ["example.chat/42", "example.chat/42"]);
    await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(blank), ToolFailureCode.Refused, "terminal.invalidBinding");
    assert.equal(harness.permissions.requests.length, 1);
  });

  it("opens the default shell when none is named, and shows no words the agent didn't give", async () => {
    const harness: ToolHarness = new ToolHarness();
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);
    await createTool(harness).handleAsync(harness.createCall({}));

    assert.equal(harness.terminals.openings[0]?.shellId, null);
    assert.equal(harness.permissions.detail(0, "Shell"), "The default shell");
    assert.equal(harness.permissions.requests[0]?.subject, "[null]");
    assert.equal(harness.permissions.detail(0, "Why"), undefined);
  });

  it("opens nothing when the request is denied", async () => {
    const harness: ToolHarness = new ToolHarness();
    harness.permissions.answerNext(PermissionDecision.Denied);

    await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({})), ToolFailureCode.Denied, null);
    assert.equal(harness.terminals.openings.length, 0);
  });

  it("reports an uncertain outcome when the call ends while the terminal opens", async () => {
    const harness: ToolHarness = new ToolHarness();
    const controller: AbortController = new AbortController();
    harness.terminals.onOpening = () => controller.abort(ToolAbortReason.Cancelled);
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);

    await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({}, controller.signal)), ToolFailureCode.OutcomeUncertain, "terminal.outcomeUncertain");
    assert.equal(harness.terminals.terminals.length, 1);
  });

  it("refuses invalid input", async () => {
    await ToolHarness.assertFailsAsync(createTool(new ToolHarness()).handleAsync(createCall({ cwd: "/" })), ToolFailureCode.Refused, "terminal.invalidInput");
  });
});
