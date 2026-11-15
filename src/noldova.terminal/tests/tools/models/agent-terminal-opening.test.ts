/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ArgumentException } from "@noldova/context.exceptions";
import { describe, it } from "vitest";

import { AgentTerminalOpening } from "../../../src/tools/models/agent-terminal-opening.ts";

describe("AgentTerminalOpening", () => {
  it("keeps the owner, the shell and the folder", () => {
    const opening: AgentTerminalOpening = new AgentTerminalOpening("session-1", "zsh", "/work/project");

    assert.equal(opening.ownerSessionId, "session-1");
    assert.equal(opening.shellId, "zsh");
    assert.equal(opening.cwd, "/work/project");
    assert.equal(opening.owner, null);
    assert.equal(new AgentTerminalOpening("session-1", "zsh", "/work/project", "example.chat/42").owner, "example.chat/42");
  });

  it("takes null for the default shell", () => {
    assert.equal(new AgentTerminalOpening("session-1", null, "/work").shellId, null);
  });

  it("refuses a blank shell, a blank owner and a relative folder", () => {
    assert.throws(() => new AgentTerminalOpening("session-1", " ", "/work"), ArgumentException);
    assert.throws(() => new AgentTerminalOpening("", null, "/work"), ArgumentException);
    assert.throws(() => new AgentTerminalOpening("session-1", null, "work"), { name: "ArgumentException", message: "The value must be an absolute path. (Parameter 'cwd')" });
  });
});
