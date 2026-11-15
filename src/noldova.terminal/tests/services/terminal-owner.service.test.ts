/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalOwnerService } from "../../src/services/terminal-owner.service.ts";
import { AgentHostFixture } from "../fixtures/agent-host.fixture.ts";

describe("TerminalOwnerService", () => {
  it("binds an agent session to an owner and unbinds it, refusing a blank session id or owner and leaving the binding as it was", () => {
    const fixture: AgentHostFixture = new AgentHostFixture();
    const service: TerminalOwnerService = new TerminalOwnerService(fixture.host);

    service.bindAgentSession("session-1", "example.chat/42");
    service.unbindAgentSession("session-2");

    assert.throws(() => service.bindAgentSession(" ", "example.chat/7"), { name: "ArgumentException", parameterName: "agentSessionId" });
    assert.throws(() => service.bindAgentSession("session-1", " "), { name: "ArgumentException", parameterName: "owner" });
    assert.throws(() => service.unbindAgentSession(""), { name: "ArgumentException", parameterName: "agentSessionId" });
    assert.equal(fixture.host.findAgentSessionOwner("session-1"), "example.chat/42");
    service.unbindAgentSession("session-1");
    assert.equal(fixture.host.findAgentSessionOwner("session-1"), null);
  });
});
