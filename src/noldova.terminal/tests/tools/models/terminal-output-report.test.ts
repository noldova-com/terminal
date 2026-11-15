/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import type { ToolResult } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { RunMethod } from "../../../src/tools/enums/run-method.ts";
import { AgentTerminalAccess } from "../../../src/tools/models/agent-terminal-access.ts";
import { OutputExcerpt } from "../../../src/tools/models/output-excerpt.ts";
import { TerminalOutputReport } from "../../../src/tools/models/terminal-output-report.ts";
import { FakeAgentCommand, FakeAgentTerminal } from "../../fixtures/fake-agent-terminals.fixture.ts";
import { ToolHarness } from "../../fixtures/tool-harness.fixture.ts";

describe("TerminalOutputReport", () => {
  it("reports a finished command's terminal title as it is then, method, output, status, exit code, folder and log as untrusted", () => {
    const terminal: FakeAgentTerminal = new FakeAgentTerminal("t1", "s1");
    const command: FakeAgentCommand = new FakeAgentCommand();
    command.method = RunMethod.OneShot;
    command.finish(2, "/work/project");
    terminal.title = "make - project";
    const result: ToolResult = new TerminalOutputReport(new AgentTerminalAccess(terminal, false), command, new OutputExcerpt("fail\n", 100), "/work/project").toResult();

    assert.equal(ToolHarness.textOf(result), "fail\n\n\n[Status: Exited. Exit code: 2. Working folder: /work/project.]");
    assert.deepEqual(result.structured, {
      terminal_id: "t1",
      title: "make - project",
      method: "OneShot",
      status: "Exited",
      exit_code: 2,
      cwd: "/work/project",
      output: "fail\n",
      omitted_characters: 0,
      log_file: "/logs/command-1.log",
      is_awaiting_secret: false
    });
    assert.equal(ToolHarness.originOf(result), "terminal:t1");
  });

  it("puts a note after the summary, such as that the command was interrupted", () => {
    const terminal: FakeAgentTerminal = new FakeAgentTerminal("t1", "s1");
    const result: ToolResult = new TerminalOutputReport(new AgentTerminalAccess(terminal, false), new FakeAgentCommand(), new OutputExcerpt("abc", 10), null)
      .toResult("\n[Interrupted.]");

    assert.equal(ToolHarness.textOf(result), "abc\n\n[Status: Running. Exit code: none. Working folder: unknown.]\n[Interrupted.]");
  });

  it("reports a terminal's own output with no command, an unknown folder and a secret prompt", () => {
    const terminal: FakeAgentTerminal = new FakeAgentTerminal("t2", null);
    terminal.isAwaitingSecret = true;
    const result: ToolResult = new TerminalOutputReport(new AgentTerminalAccess(terminal, true), null, new OutputExcerpt("Password: ", 100), null).toResult();

    assert.equal(
      ToolHarness.textOf(result),
      "Password: \n\n[Status: no command. Exit code: none. Working folder: unknown. The terminal waits for a password or another secret: only the person types it, so ask them to.]");
    assert.equal(result.structured?.["method"], null);
    assert.equal(result.structured?.["status"], null);
    assert.equal(result.structured?.["exit_code"], null);
    assert.equal(result.structured?.["log_file"], null);
    assert.equal(result.structured?.["is_awaiting_secret"], true);
  });

  it("reports a running command with no exit code yet", () => {
    const terminal: FakeAgentTerminal = new FakeAgentTerminal("t1", "s1");
    const result: ToolResult = new TerminalOutputReport(new AgentTerminalAccess(terminal, false), new FakeAgentCommand(), new OutputExcerpt("", 1), null).toResult();

    assert.equal(result.structured?.["status"], "Running");
    assert.equal(result.structured?.["exit_code"], null);
  });

  it("describes its output for agents", () => {
    assert.deepEqual(TerminalOutputReport.outputSchema["required"], [
      "terminal_id", "title", "method", "status", "exit_code", "cwd", "output", "omitted_characters", "log_file", "is_awaiting_secret"
    ]);
  });
});
