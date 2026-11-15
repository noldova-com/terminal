/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { SavedTerminal } from "../../src/models/saved-terminal.ts";

describe("SavedTerminal", () => {
  it("holds its session, shell, folder, panel flag, owner, tab flag and name", () => {
    const terminal: SavedTerminal = new SavedTerminal("s1", "bash", "/home/me", false, "app.build", false, "Build");

    assert.equal(terminal.sessionId, "s1");
    assert.equal(terminal.shellId, "bash");
    assert.equal(terminal.folder, "/home/me");
    assert.equal(terminal.isPanelTerminal, false);
    assert.equal(terminal.owner, "app.build");
    assert.equal(terminal.opensTab, false);
    assert.equal(terminal.name, "Build");
  });

  it("has no owner, opens a tab and has no name by default", () => {
    const terminal: SavedTerminal = new SavedTerminal("s2", "pwsh", "C:\\Users\\me", true);

    assert.equal(terminal.isPanelTerminal, true);
    assert.equal(terminal.owner, null);
    assert.equal(terminal.opensTab, true);
    assert.equal(terminal.name, null);
  });
});
