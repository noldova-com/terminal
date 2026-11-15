/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { CommandHistory } from "../../src/services/command-history.ts";

describe("CommandHistory", () => {
  it("keeps each shell's commands newest first, once each", () => {
    const history: CommandHistory = new CommandHistory();

    history.add("bash", "ls");
    history.add("bash", "git status");
    history.add("pwsh", "Get-ChildItem");
    history.add("bash", "ls");

    assert.deepEqual(history.list("bash"), ["ls", "git status"]);
    assert.deepEqual(history.list("pwsh"), ["Get-ChildItem"]);
    assert.deepEqual(history.list("zsh"), []);
  });

  it("drops every shell's commands at once", () => {
    const history: CommandHistory = new CommandHistory();
    history.add("bash", "ls");
    history.add("pwsh", "Get-ChildItem");

    history.clear();

    assert.deepEqual([history.list("bash"), history.list("pwsh")], [[], []]);
  });

  it("keeps at most 200 commands a shell, dropping the oldest", () => {
    const history: CommandHistory = new CommandHistory();

    for (let index: number = 0; index < 201; index++)
      history.add("bash", `echo ${index}`);

    assert.equal(history.list("bash").length, 200);
    assert.deepEqual([history.list("bash")[0], history.list("bash").at(-1)], ["echo 200", "echo 1"]);
  });
});
