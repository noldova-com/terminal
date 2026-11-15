/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
import { afterAll, beforeAll, describe, it } from "vitest";

import type { VisualStudioInstallation } from "../../src/models/visual-studio-installation.ts";
import { CommandRunner } from "../../src/services/command-runner.ts";
import { FileSystemReader } from "../../src/services/file-system.reader.ts";
import { VisualStudioReader } from "../../src/services/visual-studio.reader.ts";
import { SupervisedTerminals } from "../fixtures/supervised-terminals.fixture.ts";

describe("VisualStudioReader with this computer's vswhere", () => {
  let terminals: SupervisedTerminals;

  beforeAll(async () => {
    terminals = await SupervisedTerminals.createAsync();
  });

  afterAll(async () => {
    await terminals.endAsync();
  });

  it("reads the installations of this computer", async test => {
    test.skip(process.platform !== "win32", "vswhere and Visual Studio exist only on Windows.");
    const context: FakeRuntimePartContext = new FakeRuntimePartContext();
    context.answer("startProcessAsync", t => terminals.processes.startAsync(SupervisedTerminals.moduleId, t));

    const installations: readonly VisualStudioInstallation[] =
      await new VisualStudioReader(new CommandRunner(context), new FileSystemReader(), process.env["ProgramFiles(x86)"]).readAsync();

    await test.annotate(`Visual Studio installations: ${installations.map(t => `${t.name} (${t.instanceId})`).join(", ") || "none"}.`);
    if (process.env["GITHUB_ACTIONS"] === "true")
      assert.ok(installations.length > 0, "GitHub's Windows runner images have Visual Studio Build Tools, but vswhere lists no installation.");
    test.skip(installations.length === 0, "This computer has no Visual Studio installation to read.");
    assert.ok(installations.every(t => t.path.length > 0 && t.instanceId.length > 0));
  });
});
