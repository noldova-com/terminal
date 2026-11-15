/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ReadCursor } from "../../../src/tools/models/read-cursor.ts";
import { FakeAgentCommand, FakeAgentTerminal } from "../../fixtures/fake-agent-terminals.fixture.ts";

describe("ReadCursor", () => {
  it("reads a command's output from an offset", () => {
    const command: FakeAgentCommand = new FakeAgentCommand();
    const cursor: ReadCursor = ReadCursor.forCommand(command, 5);

    assert.equal(cursor.source, command);
    assert.equal(cursor.command, command);
    assert.equal(cursor.offset, 5);
  });

  it("reads a terminal's output, with no command", () => {
    const terminal: FakeAgentTerminal = new FakeAgentTerminal("t1", null);
    const cursor: ReadCursor = ReadCursor.forTerminal(terminal, 0);

    assert.equal(cursor.source, terminal);
    assert.equal(cursor.command, null);
  });

  it("advances to a new offset and keeps its source", () => {
    const command: FakeAgentCommand = new FakeAgentCommand();
    const advanced: ReadCursor = ReadCursor.forCommand(command, 5).advancedTo(9);

    assert.equal(advanced.offset, 9);
    assert.equal(advanced.command, command);
  });
});
