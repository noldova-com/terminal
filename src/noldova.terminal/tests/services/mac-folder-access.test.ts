/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ProcessExit } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { CommandExitedException } from "../../src/exceptions/command-exited.exception.ts";
import { MacFolderAccess } from "../../src/services/mac-folder-access.ts";
import { FakeCommandRunner } from "../fixtures/fake-command-runner.fixture.ts";

const FOLDER: string = "/var/folders/xy/T/noldova-terminal-a1";

describe("MacFolderAccess", () => {
  it("removes the folder's ACL, with every entry it inherited", async () => {
    const runner: FakeCommandRunner = new FakeCommandRunner();
    runner.answers.set("/bin/chmod", "");

    await new MacFolderAccess(runner).restrictAsync(FOLDER);

    assert.deepEqual(runner.runs, [["/bin/chmod", ["-N", FOLDER], 10_000]]);
  });

  it("fails as chmod fails", async () => {
    const runner: FakeCommandRunner = new FakeCommandRunner();
    runner.answers.set("/bin/chmod", new CommandExitedException("chmod", new ProcessExit(1, null)));

    await assert.rejects(new MacFolderAccess(runner).restrictAsync(FOLDER), new CommandExitedException("chmod", new ProcessExit(1, null)));
  });
});
