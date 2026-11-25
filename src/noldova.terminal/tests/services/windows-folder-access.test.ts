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
import { CommandVariableNotSetException } from "../../src/exceptions/command-variable-not-set.exception.ts";
import { WindowsFolderAccess } from "../../src/services/windows-folder-access.ts";
import { FakeCommandRunner } from "../fixtures/fake-command-runner.fixture.ts";
import { RecordedRun } from "../fixtures/recorded-run.fixture.ts";

const ICACLS: string = "C:\\Windows\\System32\\icacls.exe";
const FOLDER: string = "C:\\Users\\a\\AppData\\Local\\Temp\\noldova-terminal-a1";

describe("WindowsFolderAccess", () => {
  it("removes what the folder inherits and grants full control to its owner, SYSTEM and the Administrators alone, for all it will hold", async () => {
    const runner: FakeCommandRunner = new FakeCommandRunner();
    runner.answers.set(ICACLS, "processed file: a\r\nSuccessfully processed 1 files; Failed processing 0 files\r\n");

    await new WindowsFolderAccess(runner, "C:\\Windows").restrictAsync(FOLDER);

    assert.deepEqual(runner.runs, [new RecordedRun(ICACLS, [FOLDER, "/inheritance:r", "/grant:r", "*S-1-3-4:(OI)(CI)F", "*S-1-5-18:(OI)(CI)F",
      "*S-1-5-32-544:(OI)(CI)F"], 10_000)]);
  });

  it("fails as icacls fails", async () => {
    const runner: FakeCommandRunner = new FakeCommandRunner();
    runner.answers.set(ICACLS, new CommandExitedException("icacls.exe", new ProcessExit(5, null)));

    await assert.rejects(new WindowsFolderAccess(runner, "C:\\Windows").restrictAsync(FOLDER), new CommandExitedException("icacls.exe", new ProcessExit(5, null)));
  });

  it("fails without running anything when Windows' folder isn't known", async () => {
    const runner: FakeCommandRunner = new FakeCommandRunner();

    for (const systemRoot of [undefined, ""])
      await assert.rejects(new WindowsFolderAccess(runner, systemRoot).restrictAsync(FOLDER),
        new CommandVariableNotSetException("icacls.exe", "SystemRoot"));
    assert.deepEqual(runner.runs, []);
  });
});
