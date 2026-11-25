/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { FakeModuleLog, FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
import { afterAll, beforeAll, describe, it } from "vitest";

import type { TerminalHistoryPaths } from "../../src/models/terminal-history-paths.ts";
import { CommandRunner } from "../../src/services/command-runner.ts";
import { FileSystemWriter } from "../../src/services/file-system-writer.ts";
import { FileSystemReader } from "../../src/services/file-system.reader.ts";
import { FolderAccess } from "../../src/services/folder-access.ts";
import { ProcessSignaller } from "../../src/services/process-signaller.ts";
import { TerminalHistoryFolder } from "../../src/services/terminal-history-folder.ts";
import { PrivateFolder } from "../fixtures/private-folder.fixture.ts";
import { SupervisedTerminals } from "../fixtures/supervised-terminals.fixture.ts";

let terminals: SupervisedTerminals;

async function checkStoredAsync(passOn: (folder: string) => void, check: (path: string) => void): Promise<void> {
  const parent: string = await mkdtemp(join(tmpdir(), "noldova-terminal-parent-"));
  const context: FakeRuntimePartContext = new FakeRuntimePartContext();
  context.answer("startProcessAsync", t => terminals.processes.startAsync(SupervisedTerminals.moduleId, t));
  const writer: FileSystemWriter = new FileSystemWriter();
  const log: FakeModuleLog = new FakeModuleLog();
  const folder: TerminalHistoryFolder = new TerminalHistoryFolder(writer, new FileSystemReader(), new ProcessSignaller(), parent, process.pid,
    log, FolderAccess.create(process.platform, new CommandRunner(context), process.env));
  try {
    passOn(parent);

    const paths: TerminalHistoryPaths | null = await folder.pathsAsync("s1");
    assert.ok(!Object.isNull(paths), log.callsOf("write").map(t => String(t[0])).join(" "));
    const file: string = paths.first;
    await writer.writeTextAsync(file, "{}\n");

    for (const path of [dirname(file), file])
      check(path);
  }
  finally {
    await folder.removeAsync();
    await rm(parent, { recursive: true, force: true });
  }
}

describe("a terminal's stored lines", () => {
  beforeAll(async () => {
    terminals = await SupervisedTerminals.createAsync();
  });

  afterAll(async () => {
    await terminals.endAsync();
  });

  it("are readable by the person's account alone, in a folder only it reads, whatever its parent passes on", async () => {
    await checkStoredAsync(t => PrivateFolder.passOnRead(t), t => PrivateFolder.assertPrivate(t));
  });

  it("are readable by the person's account alone on Linux, whatever default ACL their parent has",
    async test => {
      test.skip(process.platform !== "linux", "POSIX default access lists are set with setfacl, which only Linux has.");
      test.skip(!Object.isNull(PrivateFolder.linuxAclMissing), PrivateFolder.linuxAclMissing ?? "");
      await checkStoredAsync(t => PrivateFolder.passOnLinuxDefaultAcl(t), t => {
        PrivateFolder.assertPrivate(t);
        PrivateFolder.assertLinuxEntriesMasked(t);
      });
    });
});
