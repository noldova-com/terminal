/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ToolFailureCode, ToolFailureException } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { AgentTerminalAccess } from "../../../src/tools/models/agent-terminal-access.ts";
import { FakeAgentTerminal } from "../../fixtures/fake-agent-terminals.fixture.ts";

describe("AgentTerminalAccess", () => {
  it("keeps the terminal, whether the person shared it, and names it as the origin of its output", () => {
    const terminal: FakeAgentTerminal = new FakeAgentTerminal("t1", null);
    const access: AgentTerminalAccess = new AgentTerminalAccess(terminal, true);

    assert.equal(access.terminal, terminal);
    assert.equal(access.isShared, true);
    assert.equal(access.origin, "terminal:t1");
  });

  it("passes a running terminal and fails an ended one as unavailable", () => {
    const terminal: FakeAgentTerminal = new FakeAgentTerminal("t1", "s1");
    const access: AgentTerminalAccess = new AgentTerminalAccess(terminal, false);
    access.requireRunning();
    terminal.isRunning = false;

    assert.throws(() => access.requireRunning(), (error: unknown) => {
      assert.ok(error instanceof ToolFailureException);
      assert.deepEqual([error.failure.code, error.failure.moduleCode, error.failure.message], [ToolFailureCode.Unavailable, "terminal.ended", "Terminal t1 has ended."]);
      return true;
    });
  });
});
