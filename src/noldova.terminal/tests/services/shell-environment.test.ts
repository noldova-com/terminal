/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { describe, it } from "vitest";

import type { IEnvironmentSource } from "../../src/interfaces/i-environment-source.ts";
import { EnvironmentTools } from "../../src/models/environment-tools.ts";
import { InheritedEnvironment } from "../../src/services/inherited-environment.ts";
import { MacEnvironment } from "../../src/services/mac-environment.ts";
import { ShellEnvironment } from "../../src/services/shell-environment.ts";
import { WindowsEnvironment } from "../../src/services/windows-environment.ts";
import { FakeCommandRunner } from "../fixtures/fake-command-runner.fixture.ts";
import { FakeFileSystemReader } from "../fixtures/fake-file-system-reader.fixture.ts";
import { FakeFileSystemWriter } from "../fixtures/fake-file-system-writer.fixture.ts";
import { FakeLineProcessStarter } from "../fixtures/fake-line-process.fixture.ts";

describe("ShellEnvironment", () => {
  it("reads Windows' variables on Windows, gives macOS a UTF-8 locale, and leaves Linux's inherited environment as it is", async () => {
    const starter: FakeLineProcessStarter = new FakeLineProcessStarter();
    const writer: FakeFileSystemWriter = new FakeFileSystemWriter();
    const tools: EnvironmentTools = new EnvironmentTools(starter, new FakeCommandRunner(), new FakeFileSystemReader(), writer, null, "/tmp");
    const asked: string[] = [];
    const create = (platform: string): IEnvironmentSource =>
      ShellEnvironment.create(platform, { PATH: "/usr/bin" }, tools, new FakeModuleLog(), "en-US", t => {
        asked.push(t);
        return Promise.resolve(true);
      });

    assert.ok(create("win32") instanceof WindowsEnvironment);
    assert.ok(create("darwin") instanceof MacEnvironment);
    const linux: IEnvironmentSource = create("linux");
    linux.start();

    assert.ok(linux instanceof InheritedEnvironment);
    assert.deepEqual(await linux.readAsync(), { PATH: "/usr/bin" });
    assert.deepEqual([starter.started, writer.folders], [[], 0]);
    assert.deepEqual(asked, []);
  });
});
