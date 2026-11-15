/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ToolFailureCode, type ToolResult } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { TerminalListTool } from "../../../src/tools/services/terminal-list-tool.ts";
import { FakeTerminalPrompt } from "../../fixtures/fake-agent-terminals.fixture.ts";
import { createCall } from "../../fixtures/tool-call-contexts.fixture.ts";
import { ToolHarness } from "../../fixtures/tool-harness.fixture.ts";

function createTool(harness: ToolHarness): TerminalListTool {
  return new TerminalListTool(harness.accessPolicy);
}

describe("TerminalListTool", () => {
  it("describes a low-risk, read-only, resumable tool, which raises no permission request", () => {
    const tool: TerminalListTool = createTool(new ToolHarness());

    assert.deepEqual(
      [tool.descriptor.name, tool.descriptor.risk, tool.descriptor.hints?.isReadOnly, tool.descriptor.isResumable, tool.descriptor.marksSending],
      ["terminal_list", { default: "Low", maximum: "Low" }, true, true, false]);
  });

  it("lists the session's own and shared terminals, asking nothing, with their titles marked as untrusted", async () => {
    const harness: ToolHarness = new ToolHarness();
    harness.terminals.add("own", "session-1");
    harness.terminals.add("shared", null).prompt = new FakeTerminalPrompt(true, null);
    harness.terminals.add("others", "session-2");

    const result: ToolResult = await createTool(harness).handleAsync(createCall({}, undefined, ["shared"]));

    assert.deepEqual(harness.permissions.requests, []);
    assert.deepEqual(result.structured, {
      terminals: [
        { terminal_id: "own", title: "bash - project", shell: "bash", cwd: "/work/project", is_shared: false, is_running: true },
        { terminal_id: "shared", title: "bash - project", shell: "bash", cwd: null, is_shared: true, is_running: true }
      ]
    });
    assert.equal(ToolHarness.textOf(result), "Terminals: own, shared.");
    assert.equal(ToolHarness.originOf(result), "terminal:titles");
  });

  it("says when the session has no terminals", async () => {
    const result: ToolResult = await createTool(new ToolHarness()).handleAsync(createCall({}));

    assert.equal(ToolHarness.textOf(result), "This session has no terminals. terminal_open opens one.");
  });

  it("refuses unknown input", async () => {
    await ToolHarness.assertFailsAsync(createTool(new ToolHarness()).handleAsync(createCall({ all: true })), ToolFailureCode.Refused, "terminal.invalidInput");
  });
});
