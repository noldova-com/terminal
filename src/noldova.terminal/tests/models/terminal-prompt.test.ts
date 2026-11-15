/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalPrompt } from "../../src/models/terminal-prompt.ts";
import { FakeTerminalPrompt } from "../fixtures/fake-agent-terminals.fixture.ts";

describe("TerminalPrompt", () => {
  const prompt: TerminalPrompt = new TerminalPrompt(true, "/work", 12, false, 3);

  it("keeps its fields", () => {
    assert.deepEqual([prompt.isIdle, prompt.cwd, prompt.promptOffset, prompt.isAwaitingSecret, prompt.inputCount], [true, "/work", 12, false, 3]);
  });

  it("equals only a prompt with the same state, folder, offset, secret wait and input count, whichever kind of prompt it is", () => {
    const same: FakeTerminalPrompt = new FakeTerminalPrompt(true, "/work", 12, false, 3);
    const other: FakeTerminalPrompt = new FakeTerminalPrompt(true, "/work", null, false, 3);

    assert.equal(prompt.equals(new TerminalPrompt(true, "/work", 12, false, 3)), true);
    assert.equal(prompt.equals(new TerminalPrompt(false, "/work", 12, false, 3)), false);
    assert.equal(prompt.equals(new TerminalPrompt(true, "/home", 12, false, 3)), false);
    assert.equal(prompt.equals(new TerminalPrompt(true, "/work", 30, false, 3)), false);
    assert.equal(prompt.equals(new TerminalPrompt(true, "/work", 12, true, 3)), false);
    assert.equal(prompt.equals(new TerminalPrompt(true, "/work", 12, false, 4)), false);
    assert.equal(prompt.equals(same), true);
    assert.equal(prompt.equals(other), false);
  });
});
