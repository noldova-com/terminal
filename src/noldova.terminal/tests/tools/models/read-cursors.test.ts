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
import { ReadCursors } from "../../../src/tools/models/read-cursors.ts";
import { FakeAgentTerminal } from "../../fixtures/fake-agent-terminals.fixture.ts";

describe("ReadCursors", () => {
  const terminal: FakeAgentTerminal = new FakeAgentTerminal("t1", null);

  it("keeps one cursor per session and terminal", () => {
    const cursors: ReadCursors = new ReadCursors();
    cursors.set("s1", "t1", ReadCursor.forTerminal(terminal, 1));
    cursors.set("s1", "t2", ReadCursor.forTerminal(terminal, 2));
    cursors.set("s2", "t1", ReadCursor.forTerminal(terminal, 3));
    cursors.set("s1", "t1", ReadCursor.forTerminal(terminal, 4));

    assert.equal(cursors.find("s1", "t1")?.offset, 4);
    assert.equal(cursors.find("s1", "t2")?.offset, 2);
    assert.equal(cursors.find("s2", "t1")?.offset, 3);
    assert.equal(cursors.find("s3", "t1"), undefined);
  });

  it("forgets a terminal in every session", () => {
    const cursors: ReadCursors = new ReadCursors();
    cursors.set("s1", "t1", ReadCursor.forTerminal(terminal, 1));
    cursors.set("s2", "t1", ReadCursor.forTerminal(terminal, 1));
    cursors.set("s2", "t2", ReadCursor.forTerminal(terminal, 1));
    cursors.forgetTerminal("t1");

    assert.equal(cursors.find("s1", "t1"), undefined);
    assert.equal(cursors.find("s2", "t1"), undefined);
    assert.equal(cursors.find("s2", "t2")?.offset, 1);
  });

  it("forgets a session", () => {
    const cursors: ReadCursors = new ReadCursors();
    cursors.set("s1", "t1", ReadCursor.forTerminal(terminal, 1));
    cursors.set("s2", "t1", ReadCursor.forTerminal(terminal, 1));
    cursors.forgetSession("s1");

    assert.equal(cursors.find("s1", "t1"), undefined);
    assert.equal(cursors.find("s2", "t1")?.offset, 1);
  });
});
