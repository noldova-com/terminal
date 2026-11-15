/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import type { IFolderAccess } from "../../src/interfaces/i-folder-access.ts";
import { FolderAccess } from "../../src/services/folder-access.ts";
import { MacFolderAccess } from "../../src/services/mac-folder-access.ts";
import { WindowsFolderAccess } from "../../src/services/windows-folder-access.ts";
import { FakeCommandRunner } from "../fixtures/fake-command-runner.fixture.ts";

describe("FolderAccess", () => {
  it("gives Windows and macOS folders an access of their own, from Windows' folder on Windows, and Linux folders none", async () => {
    const runner: FakeCommandRunner = new FakeCommandRunner();
    runner.answers.set("C:\\Win\\System32\\icacls.exe", "");

    const windows: IFolderAccess | null = FolderAccess.create("win32", runner, { SystemRoot: "C:\\Win" });
    await windows?.restrictAsync("C:\\Temp\\a");

    assert.ok(windows instanceof WindowsFolderAccess);
    assert.deepEqual(runner.runs.map(t => t[0]), ["C:\\Win\\System32\\icacls.exe"]);
    assert.ok(FolderAccess.create("darwin", runner, {}) instanceof MacFolderAccess);
    assert.equal(FolderAccess.create("linux", runner, { SystemRoot: "C:\\Win" }), null);
  });
});
