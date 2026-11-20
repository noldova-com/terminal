/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { TerminalEvents } from "../../src/models/terminal-events.ts";
import { CompletionSource } from "../../src/services/completion-source.ts";
import { InheritedEnvironment } from "../../src/services/inherited-environment.ts";
import { LatestEnvironment } from "../../src/services/latest-environment.ts";
import { SavedTerminals } from "../../src/services/saved-terminals.ts";
import { ShellIntegration } from "../../src/services/shell-integration.ts";
import { ShellLocator } from "../../src/services/shell-locator.ts";
import { TerminalHistoryFolder } from "../../src/services/terminal-history-folder.ts";
import { TerminalHost } from "../../src/services/terminal-host.ts";
import { FakeCommandRunner } from "./fake-command-runner.fixture.ts";
import { FakeFileSystemReader } from "./fake-file-system-reader.fixture.ts";
import { FakeFileSystemWriter } from "./fake-file-system-writer.fixture.ts";
import { FakeProcessSignaller } from "./fake-process-signaller.fixture.ts";
import type { FakePtyProcess } from "./fake-pty-process.fixture.ts";
import { FakePtySpawner } from "./fake-pty-spawner.fixture.ts";
import { FakeEventChannel, FakeModuleLog, FakeModuleSettings } from "./fake-runtime-part-context.fixture.ts";
import { MemoryModuleDatabase } from "./memory-module-database.fixture.ts";

export class AgentHostFixture {
  public readonly spawner: FakePtySpawner = new FakePtySpawner();
  public readonly fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
  public readonly writer: FakeFileSystemWriter = new FakeFileSystemWriter();
  public readonly historyWriter: FakeFileSystemWriter = new FakeFileSystemWriter();
  public readonly signaller: FakeProcessSignaller = new FakeProcessSignaller();
  public readonly log: FakeModuleLog = new FakeModuleLog();
  public readonly exited: FakeEventChannel = new FakeEventChannel();
  public readonly commandAdded: FakeEventChannel = new FakeEventChannel();
  public readonly settings: FakeModuleSettings = new FakeModuleSettings();
  public readonly host: TerminalHost;

  public constructor() {
    this.fileSystem.files.set("/etc/shells", "/bin/bash\n/usr/bin/fish\n");
    this.fileSystem.files.set("/bin/bash", "");
    this.fileSystem.files.set("/usr/bin/fish", "");
    this.fileSystem.folders.add("/work");
    this.host = new TerminalHost(
      this.spawner,
      this.fileSystem,
      new ShellIntegration(this.writer, "/tmp", this.log, null, this.settings, "linux"),
      new TerminalHistoryFolder(this.historyWriter, this.fileSystem, this.signaller, "/tmp", 400, this.log),
      new ShellLocator("linux", "x64", { SHELL: "/bin/bash" }, null, this.fileSystem, new FakeCommandRunner(), this.log),
      "linux",
      "6.8.0",
      new LatestEnvironment(new InheritedEnvironment({ SHELL: "/bin/bash" }), { SHELL: "/bin/bash" }),
      "/home/a",
      this.log,
      new TerminalEvents(new FakeEventChannel(), this.exited, new FakeEventChannel(), new FakeEventChannel(), new FakeEventChannel(), new FakeEventChannel(),
        new FakeEventChannel(), new FakeEventChannel(), new FakeEventChannel(), new FakeEventChannel(), new FakeEventChannel(), new FakeEventChannel(),
        this.commandAdded),
      new SavedTerminals(new MemoryModuleDatabase(SavedTerminals.migrations), this.log),
      new CompletionSource(this.fileSystem, new FakeCommandRunner(), "linux", "/home/a", this.log));
  }

  public get process(): FakePtyProcess {
    const process: FakePtyProcess | undefined = this.spawner.spawned.at(-1);
    assert.ok(process !== undefined, "Nothing was spawned.");
    return process;
  }

  public mark(kind: string, value?: string): string {
    return this.markFor(this.process, kind, value);
  }

  public markFor(process: FakePtyProcess, kind: string, value?: string): string {
    const nonce: string = this.writer.nonceFor(this.spawner.environments[this.spawner.spawned.indexOf(process)]);
    return `\u001b]6973;${kind};${nonce}${value === undefined ? "" : `;${value}`}\u0007`;
  }
}
