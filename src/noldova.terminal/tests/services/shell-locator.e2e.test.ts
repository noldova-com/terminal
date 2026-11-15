/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";

import { FakeModuleLog, FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
import { afterAll, beforeAll, describe, it } from "vitest";

import type { Shell } from "../../src/models/shell.ts";
import type { VisualStudioInstallation } from "../../src/models/visual-studio-installation.ts";
import { CommandRunner } from "../../src/services/command-runner.ts";
import { FileSystemReader } from "../../src/services/file-system.reader.ts";
import { ShellLocator } from "../../src/services/shell-locator.ts";
import { VisualStudioReader } from "../../src/services/visual-studio.reader.ts";
import { SupervisedTerminals } from "../fixtures/supervised-terminals.fixture.ts";

describe("ShellLocator with this computer's Visual Studio installations, read with vswhere", () => {
  let terminals: SupervisedTerminals;

  beforeAll(async () => {
    terminals = await SupervisedTerminals.createAsync();
  });

  afterAll(async () => {
    await terminals.endAsync();
  });

  it("lists the developer shells of each installation that has them, logging nothing", async test => {
    test.skip(process.platform !== "win32", "Visual Studio's developer shells run only on Windows.");
    const context: FakeRuntimePartContext = new FakeRuntimePartContext();
    context.answer("startProcessAsync", t => terminals.processes.startAsync(SupervisedTerminals.moduleId, t));
    const runner: CommandRunner = new CommandRunner(context);
    const reader: FileSystemReader = new FileSystemReader();
    const log: FakeModuleLog = new FakeModuleLog();
    const installations: readonly VisualStudioInstallation[] = await new VisualStudioReader(runner, reader, process.env["ProgramFiles(x86)"]).readAsync();
    const shells: readonly Shell[] = await new ShellLocator(process.platform, process.arch, process.env, null, reader, runner, log).locateAsync();

    const expected: string[] = [];
    for (const installation of installations) {
      const tools: string = path.win32.join(installation.path, "Common7", "Tools");
      if (await reader.isFileAsync(path.win32.join(tools, "VsDevCmd.bat")))
        expected.push(`vs-${installation.instanceId}-cmd`);
      if (await reader.isFileAsync(path.win32.join(tools, "Microsoft.VisualStudio.DevShell.dll")))
        expected.push(`vs-${installation.instanceId}-powershell`);
    }

    await test.annotate(`Visual Studio installations: ${installations.map(t => `${t.name} (${t.instanceId})`).join(", ") || "none"}.`);
    if (process.env["GITHUB_ACTIONS"] === "true")
      assert.ok(expected.length > 0, "GitHub's Windows runner images have Visual Studio Build Tools, but no developer shell is found.");
    assert.deepEqual(shells.filter(t => t.id.startsWith("vs-")).map(t => t.id), expected);
    assert.deepEqual(log.callsOf("write"), []);
  });
});
