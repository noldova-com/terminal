/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { WslLauncher } from "../../src/models/wsl-launcher.ts";
import { WslDistributionReader } from "../../src/services/wsl-distribution.reader.ts";
import { FakeCommandRunner } from "../fixtures/fake-command-runner.fixture.ts";

describe("WslLauncher", () => {
  it("holds its file and its distribution reader", () => {
    const reader: WslDistributionReader = new WslDistributionReader(new FakeCommandRunner(), "C:\\Windows");

    const launcher: WslLauncher = new WslLauncher("C:\\Windows\\System32\\wsl.exe", reader);

    assert.equal(launcher.file, "C:\\Windows\\System32\\wsl.exe");
    assert.equal(launcher.reader, reader);
  });
});
