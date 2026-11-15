/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { AgentTerminalRestartException } from "../../src/exceptions/agent-terminal-restart.exception.ts";

describe("AgentTerminalRestartException", () => {
  it("names the agent's terminal it would not restart", () => {
    const error: AgentTerminalRestartException = new AgentTerminalRestartException("s9");

    assert.ok(error instanceof Error);
    assert.equal(error.name, "AgentTerminalRestartException");
    assert.equal(error.sessionId, "s9");
    assert.equal(error.message, "Terminal s9 belongs to an agent session, which starts and ends its shell.");
  });
});
