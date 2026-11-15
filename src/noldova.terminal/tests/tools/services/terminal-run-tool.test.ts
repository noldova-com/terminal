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

import { TerminalRunTool } from "../../../src/tools/services/terminal-run-tool.ts";
import type { FakeAgentTerminal } from "../../fixtures/fake-agent-terminals.fixture.ts";
import { FakeTerminalPrompt } from "../../fixtures/fake-agent-terminals.fixture.ts";
import { ToolHarness } from "../../fixtures/tool-harness.fixture.ts";

function createTool(harness: ToolHarness): TerminalRunTool {
  return new TerminalRunTool(harness.accessPolicy, harness.gate, harness.cursors);
}

describe("TerminalRunTool", () => {
  it("describes a high-risk, open-world, resumable tool, one call per terminal, that marks when it sends", () => {
    const tool: TerminalRunTool = createTool(new ToolHarness());

    assert.deepEqual(
      [tool.descriptor.name, tool.descriptor.risk, tool.descriptor.deadline, tool.descriptor.hints, tool.descriptor.resource, tool.descriptor.isResumable,
        tool.descriptor.marksSending, tool.descriptor.nextTool],
      ["terminal_run", { default: "High", maximum: "High" }, { default: 10_000, maximum: 30_000 }, { isReadOnly: false, isDestructive: true, isOpenWorld: true },
        "/terminal_id", true, true, undefined]);
    assert.deepEqual(tool.descriptor.inputSchema["required"], ["terminal_id", "command"]);
  });

  it("asks once as terminal.run with the exact command, terminal, shell and folder, remembered by their hash, then runs only that command", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
    terminal.nextCommand.output = "ok\n";
    terminal.nextCommand.finish(0, "/work/project/src");
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);

    const result: ToolResult = await createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", command: "npm test \u200B", explanation: "Runs the tests.", yield_ms: 2_000, timeout_ms: 60_000 }));

    assert.deepEqual(harness.permissions.requests, [{
      action: "terminal.run",
      subject: "sha256:5d6f432043ac76adfb253a218f940146323207904a3ed7ed55601b59aa868e8f",
      title: "Run a command in a terminal",
      details: [
        { label: "Terminal", kind: "Text", value: "bash - project" },
        { label: "Terminal id", kind: "Code", value: "t1" },
        { label: "Shared by you", kind: "Text", value: "No" },
        { label: "Shell", kind: "Text", value: "bash" },
        { label: "Shell program", kind: "Code", value: "/bin/bash" },
        { label: "Working folder", kind: "Code", value: "/work/project" },
        { label: "Inside the session's working folder", kind: "Text", value: "Yes" },
        { label: "Command", kind: "Code", value: "npm test \\u{200B}" },
        { label: "Holds characters that hide or reorder text, shown escaped", kind: "Text", value: "Yes" },
        { label: "Runs", kind: "Text", value: "At the shell's prompt" },
        { label: "Why", kind: "AgentText", value: "Runs the tests." }
      ],
      risk: "High",
      isAsking: true,
      options: ["AllowOnce", "AllowAlways", "Deny"]
    }]);
    assert.deepEqual(terminal.runs, [{ command: "npm test \u200B", timeoutMilliseconds: 60_000 }]);
    assert.equal(terminal.nextCommand.endWaits[0]?.timeoutMilliseconds, 2_000);
    assert.equal(result.structured?.["status"], "Exited");
    assert.equal(result.structured?.["exit_code"], 0);
    assert.equal(result.structured?.["cwd"], "/work/project/src");
    assert.equal(result.structured?.["output"], "ok\n");
    assert.equal(result.structured?.["log_file"], "/logs/command-1.log");
    assert.equal(ToolHarness.originOf(result), "terminal:t1");
    assert.equal(harness.cursors.find("session-1", "t1")?.offset, 3);
  });

  it("returns a command still running at its yield, which keeps running", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
    terminal.nextCommand.output = "building";
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);

    const result: ToolResult = await createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", command: "make" }));

    assert.equal(result.structured?.["status"], "Running");
    assert.equal(result.structured?.["exit_code"], null);
    assert.equal(terminal.nextCommand.endWaits[0]?.timeoutMilliseconds, 10_000);
    assert.deepEqual(terminal.runs, [{ command: "make", timeoutMilliseconds: 0 }]);
  });

  it("cuts long output to max_chars, keeping its head and tail", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
    terminal.nextCommand.output = "0123456789";
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);

    const result: ToolResult = await createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", command: "seq", max_chars: 4 }));

    assert.equal(result.structured?.["omitted_characters"], 6);
    assert.equal(harness.cursors.find("session-1", "t1")?.offset, 10);
  });

  it("runs in a terminal the person shared, and says so on the request", async () => {
    const harness: ToolHarness = new ToolHarness();
    harness.terminals.add("shared", null);
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);
    await createTool(harness).handleAsync(harness.createCall({ terminal_id: "shared", command: "ls" }, undefined, ["shared"]));

    assert.equal(harness.permissions.detail(0, "Shared by you"), "Yes");
  });

  it("says a terminal without integration runs the command as a one-shot, in the folder its shell started in, and shows the program line with its hidden characters escaped", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
    terminal.hasShellIntegration = false;
    terminal.oneShotProgram = "wsl.exe -d Ubuntu -e sh -c";
    terminal.prompt = new FakeTerminalPrompt(true, null);
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);
    await createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", command: "ls \u200B" }));

    assert.equal(harness.permissions.detail(0, "Runs"), undefined);
    assert.equal(harness.permissions.detail(0, "Runs as this program line, since the shell has no integration"), "wsl.exe -d Ubuntu -e sh -c ls \\u{200B}");
    assert.deepEqual(harness.permissions.requests[0]?.details.find(t => t.label === "Working folder"),
      { label: "Working folder", kind: "Code", value: "/work/start" });
    assert.equal(harness.permissions.detail(0, "Inside the session's working folder"), "No");
    assert.equal(harness.permissions.requests[0]?.subject, "sha256:02cffe5cc3423115aebf443ddf47947315df5820dc02f3fb22fac75cdc33623d");
  });

  it("shows a title and a folder a program set with their controls and hidden characters escaped, and their backslashes as they are", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
    terminal.title = "safe\u202Eexe.txt\u0007";
    terminal.prompt = new FakeTerminalPrompt(true, "C:\\work\u200B\\project");
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);
    await createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", command: "dir" }));

    assert.equal(harness.permissions.detail(0, "Terminal"), "safe\\u{202E}exe.txt\\u{0007}");
    assert.equal(harness.permissions.detail(0, "Working folder"), "C:\\work\\u{200B}\\project");
  });

  it("shows the one-shot program line with the command's backslashes as the shell reads them, where the escaped command doubles them", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
    terminal.hasShellIntegration = false;
    terminal.oneShotProgram = "wsl.exe -d Ubuntu -e sh -c";
    terminal.prompt = new FakeTerminalPrompt(true, null);
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);
    await createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", command: "printf 'a\\nb' > out\\log" }));

    assert.deepEqual([harness.permissions.detail(0, "Runs as this program line, since the shell has no integration"), harness.permissions.detail(0, "Command")],
      ["wsl.exe -d Ubuntu -e sh -c printf 'a\\nb' > out\\log", "printf 'a\\\\nb' > out\\\\log"]);
  });

  it("says a folder outside the working folder is outside it", async () => {
    const harness: ToolHarness = new ToolHarness();
    harness.terminals.add("t1", "session-1").prompt = new FakeTerminalPrompt(true, "/etc");
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);
    await createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", command: "ls" }));

    assert.equal(harness.permissions.detail(0, "Inside the session's working folder"), "No");
  });

  it("asks for the longest command at the prompt, whose escaped form fits a request", async () => {
    const harness: ToolHarness = new ToolHarness();
    harness.terminals.add("t1", "session-1");
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);
    await createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", command: "\\".repeat(16_384) }));

    assert.equal(harness.permissions.detail(0, "Command"), "\\".repeat(32_768));
  });

  it("refuses a one-shot whose command and program line can't both be shown, more than 80 KiB as JSON, before asking", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
    terminal.hasShellIntegration = false;
    terminal.oneShotProgram = "sh -c";

    const failure: ToolFailure = await ToolHarness.assertFailsAsync(
      createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", command: "\\".repeat(16_384) })), ToolFailureCode.Refused, "terminal.requestTooLarge");

    assert.equal(failure.message, "terminal_run did not run: its permission request can't show its exact input, which is more than 81920 bytes as JSON.");
    assert.equal(harness.permissions.requests.length, 0);
    assert.deepEqual(terminal.runs, []);
  });

  for (const [outcome, code] of [[PermissionDecision.Denied, ToolFailureCode.Denied], [PermissionDecision.DeniedAlways, ToolFailureCode.Denied],
    [PermissionDecision.Expired, ToolFailureCode.Expired], [PermissionDecision.Withdrawn, ToolFailureCode.Withdrawn]] as const) {
    it(`runs nothing when the request ends as ${outcome}`, async () => {
      const harness: ToolHarness = new ToolHarness();
      const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
      harness.permissions.answerNext(outcome);

      await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", command: "rm -rf build" })), code, null);
      assert.deepEqual(terminal.runs, []);
    });
  }

  it("runs nothing when the terminal changed after the grant", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);
    harness.permissions.whenRaised(() => {
      terminal.prompt = new FakeTerminalPrompt(true, "/elsewhere");
    });

    await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", command: "ls" })), ToolFailureCode.Stale, "terminal.stale");
    assert.deepEqual(terminal.runs, []);
  });

  it("asks nothing while the terminal isn't waiting at an empty prompt", async () => {
    const harness: ToolHarness = new ToolHarness();
    harness.terminals.add("t1", "session-1").prompt = new FakeTerminalPrompt(false, "/work/project");

    await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", command: "ls" })), ToolFailureCode.Unavailable, "terminal.notIdle");
    assert.equal(harness.permissions.requests.length, 0);
  });

  it("refuses an ended terminal, another session's terminal and invalid input before asking", async () => {
    const harness: ToolHarness = new ToolHarness();
    harness.terminals.add("ended", "session-1").isRunning = false;
    harness.terminals.add("others", "session-2");

    await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({ terminal_id: "ended", command: "ls" })), ToolFailureCode.Unavailable, "terminal.ended");
    await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({ terminal_id: "others", command: "ls" })), ToolFailureCode.Refused, "terminal.notFound");
    await ToolHarness.assertFailsAsync(createTool(harness).handleAsync(harness.createCall({ terminal_id: "ended", command: "a\nb" })), ToolFailureCode.Refused, "terminal.invalidInput");
    assert.equal(harness.permissions.requests.length, 0);
  });

  it("fails with what ended the call and the status and output so far when it ends after the command started, and leaves it running", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
    const controller: AbortController = new AbortController();
    terminal.nextCommand.output = "started";
    terminal.nextCommand.onWait = () => controller.abort(ToolAbortReason.DeadlineReached);
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);

    const failure: ToolFailure = await ToolHarness.assertFailsAsync(
      createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", command: "sleep 100" }, controller.signal)), ToolFailureCode.TimedOut, null);

    assert.equal(failure.message, "terminal_run ended before it finished; the output so far follows.");
    assert.equal(terminal.runs.length, 1);
    assert.equal(terminal.nextCommand.interrupts, 0);
    assert.equal(ToolHarness.textOf(failure).slice(0, 7), "started");
    assert.match(ToolHarness.textOf(failure), /\[Status: Running\./u);
    assert.equal(ToolHarness.originOf(failure), "terminal:t1");
    assert.equal(harness.cursors.find("session-1", "t1")?.offset, 0);
  });

  it("interrupts the command it started when the person stops the call, and says so", async () => {
    const harness: ToolHarness = new ToolHarness();
    const terminal: FakeAgentTerminal = harness.terminals.add("t1", "session-1");
    const controller: AbortController = new AbortController();
    terminal.nextCommand.output = "started";
    terminal.nextCommand.onWait = () => controller.abort(ToolAbortReason.Stopped);
    harness.permissions.answerNext(PermissionDecision.AllowedOnce);

    const failure: ToolFailure = await ToolHarness.assertFailsAsync(
      createTool(harness).handleAsync(harness.createCall({ terminal_id: "t1", command: "sleep 100" }, controller.signal)), ToolFailureCode.Stopped, null);

    assert.equal(failure.message, "terminal_run ended before it finished, so the command its run started was interrupted; the output so far follows.");
    assert.equal(terminal.nextCommand.interrupts, 1);
    assert.match(ToolHarness.textOf(failure), /^started[\s\S]*\n\[The command was interrupted because the call ended\.\]$/u);
  });
});
