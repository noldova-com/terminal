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

import { CommandRunner } from "../../src/services/command-runner.ts";
import { WslDistributionReader } from "../../src/services/wsl-distribution.reader.ts";
import { SupervisedTerminals } from "../fixtures/supervised-terminals.fixture.ts";

describe("WslDistributionReader with this computer's Windows PowerShell and registry", () => {
  let terminals: SupervisedTerminals;

  beforeAll(async () => {
    terminals = await SupervisedTerminals.createAsync();
  });

  afterAll(async () => {
    await terminals.endAsync();
  });

  it("reads the distributions of this computer", async test => {
    test.skip(process.platform !== "win32", "WSL and Windows PowerShell exist only on Windows.");
    const context: FakeRuntimePartContext = new FakeRuntimePartContext();
    context.answer("startProcessAsync", t => terminals.processes.startAsync(SupervisedTerminals.moduleId, t));

    const systemRoot: string | undefined = process.env["SystemRoot"];
    assert.ok(systemRoot !== undefined, "SystemRoot is not set.");

    const distributions: readonly string[] = await new WslDistributionReader(new CommandRunner(context), systemRoot).readAsync();

    await test.annotate(`WSL distributions: ${distributions.join(", ") || "none"}.`);
    test.skip(distributions.length === 0, "This computer has no WSL distribution to read.");
    assert.ok(distributions.every(t => t.trim().length > 0));
  });
});
