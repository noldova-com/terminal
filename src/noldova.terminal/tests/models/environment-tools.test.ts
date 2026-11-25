/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { EnvironmentTools } from "../../src/models/environment-tools.ts";
import { FakeCommandRunner } from "../fixtures/fake-command-runner.fixture.ts";
import { FakeFileSystemReader } from "../fixtures/fake-file-system-reader.fixture.ts";
import { FakeFileSystemWriter } from "../fixtures/fake-file-system-writer.fixture.ts";
import { FakeFolderAccess } from "../fixtures/fake-folder-access.fixture.ts";
import { FakeLineProcessStarter } from "../fixtures/fake-line-process.fixture.ts";

describe("EnvironmentTools", () => {
  it("holds the starter, runner, reader, writer, folder access and temporary folder it is given", () => {
    const starter: FakeLineProcessStarter = new FakeLineProcessStarter();
    const runner: FakeCommandRunner = new FakeCommandRunner();
    const reader: FakeFileSystemReader = new FakeFileSystemReader();
    const writer: FakeFileSystemWriter = new FakeFileSystemWriter();
    const access: FakeFolderAccess = new FakeFolderAccess(writer);

    const tools: EnvironmentTools = new EnvironmentTools(starter, runner, reader, writer, access, "/tmp");

    assert.equal(tools.starter, starter);
    assert.equal(tools.runner, runner);
    assert.equal(tools.reader, reader);
    assert.equal(tools.writer, writer);
    assert.equal(tools.access, access);
    assert.equal(tools.temporaryFolder, "/tmp");
  });

  it("holds no folder access when it is given none", () => {
    const tools: EnvironmentTools = new EnvironmentTools(new FakeLineProcessStarter(), new FakeCommandRunner(), new FakeFileSystemReader(),
      new FakeFileSystemWriter(), null, "/tmp");

    assert.equal(tools.access, null);
  });
});
