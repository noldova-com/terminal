/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { FakeModuleLog, FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
import { afterAll, beforeAll, describe, it } from "vitest";

import { EnvironmentTools } from "../../src/models/environment-tools.ts";
import { CommandRunner } from "../../src/services/command-runner.ts";
import { FileSystemWriter } from "../../src/services/file-system-writer.ts";
import { FileSystemReader } from "../../src/services/file-system.reader.ts";
import { FolderAccess } from "../../src/services/folder-access.ts";
import { LineProcessStarter } from "../../src/services/line-process-starter.ts";
import { WindowsEnvironment } from "../../src/services/windows-environment.ts";
import { SupervisedTerminals } from "../fixtures/supervised-terminals.fixture.ts";

describe("WindowsEnvironment on Windows", () => {
  let terminals: SupervisedTerminals;

  beforeAll(async () => {
    terminals = await SupervisedTerminals.createAsync();
  });

  afterAll(async () => {
    await terminals.endAsync();
  });

  it("reads the machine's variables with reg.exe, beyond what it inherited, and leaves no export behind", async test => {
    test.skip(process.platform !== "win32", "reg.exe and the machine's and the person's Environment keys exist only on Windows.");
    const systemRoot: string = process.env["SystemRoot"] ?? "";
    const parent: string = await mkdtemp(path.join(tmpdir(), "noldova-terminal-environment-test-"));
    const context: FakeRuntimePartContext = new FakeRuntimePartContext();
    context.answer("startProcessAsync", t => terminals.processes.startAsync(SupervisedTerminals.moduleId, t));
    const runner: CommandRunner = new CommandRunner(context);
    const log: FakeModuleLog = new FakeModuleLog();
    const source: WindowsEnvironment = new WindowsEnvironment({ SystemRoot: systemRoot }, new EnvironmentTools(new LineProcessStarter(context), runner,
      new FileSystemReader(), new FileSystemWriter(), FolderAccess.create(process.platform, runner, process.env), parent), log);
    try {
      const started: number = performance.now();
      const first: Readonly<Record<string, string | undefined>> = await source.readAsync();
      const firstRead: number = performance.now();
      const second: Readonly<Record<string, string | undefined>> = await source.readAsync();
      const secondRead: number = performance.now();
      const folders: readonly string[] = await readdir(parent);
      const exports: readonly string[] = (await Promise.all(folders.map(t => readdir(path.join(parent, t))))).flat();

      const writes: readonly string[] = log.callsOf("write").map(t => String(t[0]));
      const retries: readonly string[] = writes.filter(t => t.startsWith("reg.exe could not write its export of the key "));
      console.log(`reg.exe exported first in ${Math.round(firstRead - started)} ms, then in ${Math.round(secondRead - firstRead)} ms.${retries.map(t => ` ${t}`).join("")}`);
      assert.deepEqual(writes.filter(t => !retries.includes(t)), []);
      assert.deepEqual([folders.length, exports], [1, []]);
      for (const environment of [first, second]) {
        assert.equal(environment["ComSpec"]?.toLowerCase(), path.win32.join(systemRoot, "system32", "cmd.exe").toLowerCase());
        assert.ok((environment["Path"] ?? "").toLowerCase().split(";").includes(path.win32.join(systemRoot, "system32").toLowerCase()), environment["Path"]);
      }
    }
    finally {
      source.end();
      await rm(parent, { force: true, recursive: true });
    }
  });
});
