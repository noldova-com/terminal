/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, type JsonValue } from "@noldova/context.json";
import { FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";
import { TerminalAttachment, TerminalCompletion, TerminalLaunched, TerminalLinePage, TerminalMissingCommands, TerminalOutput, TerminalReference, TerminalRunResult, TerminalSessions, TerminalShellKind, TerminalSize, TerminalSummary } from "@noldova/terminal.protocol";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

import { AgentTerminalRestartException } from "../../src/exceptions/agent-terminal-restart.exception.ts";
import { DefaultShellNotFoundException } from "../../src/exceptions/default-shell-not-found.exception.ts";
import { FolderNotFoundException } from "../../src/exceptions/folder-not-found.exception.ts";
import { HostEndedException } from "../../src/exceptions/host-ended.exception.ts";
import { SessionNotFoundException } from "../../src/exceptions/session-not-found.exception.ts";
import { ShellKindNotFoundException } from "../../src/exceptions/shell-kind-not-found.exception.ts";
import { ShellNotFoundException } from "../../src/exceptions/shell-not-found.exception.ts";
import { UnknownMethodException } from "../../src/exceptions/unknown-method.exception.ts";
import { UnsupportedSystemException } from "../../src/exceptions/unsupported-system.exception.ts";
import type { IEnvironmentSource } from "../../src/interfaces/i-environment-source.ts";
import type { IPtyProcess } from "../../src/interfaces/i-pty-process.ts";
import { RequestClient } from "../../src/models/request-client.ts";
import { SavedTerminal } from "../../src/models/saved-terminal.ts";
import { TerminalEvents } from "../../src/models/terminal-events.ts";
import { CompletionSource } from "../../src/services/completion-source.ts";
import { FileSystemWriter } from "../../src/services/file-system-writer.ts";
import { FileSystemReader } from "../../src/services/file-system.reader.ts";
import { InheritedEnvironment } from "../../src/services/inherited-environment.ts";
import { ProcessSignaller } from "../../src/services/process-signaller.ts";
import { SavedTerminals } from "../../src/services/saved-terminals.ts";
import { ShellIntegration } from "../../src/services/shell-integration.ts";
import { ShellLocator } from "../../src/services/shell-locator.ts";
import { TerminalHistoryFolder } from "../../src/services/terminal-history-folder.ts";
import { TerminalHost } from "../../src/services/terminal-host.ts";
import { TerminalSession } from "../../src/services/terminal-session.ts";
import { FakeCommandRunner } from "../fixtures/fake-command-runner.fixture.ts";
import { FakeFileSystemReader } from "../fixtures/fake-file-system-reader.fixture.ts";
import { FakeFileSystemWriter } from "../fixtures/fake-file-system-writer.fixture.ts";
import { FakeFolderAccess } from "../fixtures/fake-folder-access.fixture.ts";
import { FakeProcessSignaller } from "../fixtures/fake-process-signaller.fixture.ts";
import type { FakePtyProcess } from "../fixtures/fake-pty-process.fixture.ts";
import { FakePtySpawner } from "../fixtures/fake-pty-spawner.fixture.ts";
import { FakeEventChannel, FakeModuleLog, FakeModuleSettings } from "../fixtures/fake-runtime-part-context.fixture.ts";
import { MemoryModuleDatabase } from "../fixtures/memory-module-database.fixture.ts";

const OPEN: JsonValue = { shellId: "bash", folder: "/work", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 };
const ZSH_OPEN: JsonValue = { shellId: "zsh", folder: "/work", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 };
const SIZE: JsonValue = { cols: 80, rows: 24 };
const PANE_SIZE: JsonValue = { cols: 120, rows: 30 };
const RESTORE: JsonValue = { size: SIZE, shellId: null, storedLimit: 104_857_600 };
const END_STEP_MS: number = 500;
const END_GUARD_MS: number = 30_000;
const APP: RequestClient = new RequestClient(1, 1, true);
const COMMAND_LINE: RequestClient = new RequestClient(2, null, false);

function ownedOpen(owner: string): JsonValue {
  return { shellId: "bash", folder: "/work", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, owner };
}

class OpenedTerminal {
  public readonly sessionId: string;
  public readonly process: FakePtyProcess;

  public constructor(sessionId: string, process: FakePtyProcess) {
    this.sessionId = sessionId;
    this.process = process;
  }
}

class OpeningRun {
  public readonly result: Promise<TerminalRunResult>;
  public readonly sessionId: string;
  public readonly spawning: Promise<FakePtyProcess>;

  public constructor(result: Promise<TerminalRunResult>, sessionId: string, spawning: Promise<FakePtyProcess>) {
    this.result = result;
    this.sessionId = sessionId;
    this.spawning = spawning;
  }
}

class StartedRun {
  public readonly result: Promise<TerminalRunResult>;
  public readonly sessionId: string;
  public readonly process: FakePtyProcess;

  public constructor(result: Promise<TerminalRunResult>, sessionId: string, process: FakePtyProcess) {
    this.result = result;
    this.sessionId = sessionId;
    this.process = process;
  }
}

class HostFixture {
  public readonly spawner: FakePtySpawner = new FakePtySpawner();
  public readonly fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
  public readonly writer: FakeFileSystemWriter = new FakeFileSystemWriter();
  public readonly historyWriter: FakeFileSystemWriter = new FakeFileSystemWriter();
  public readonly signaller: FakeProcessSignaller = new FakeProcessSignaller();
  public readonly log: FakeModuleLog = new FakeModuleLog();
  public readonly settings: FakeModuleSettings = new FakeModuleSettings();
  public readonly runner: FakeCommandRunner = new FakeCommandRunner();
  public readonly output: FakeEventChannel = new FakeEventChannel();
  public readonly exited: FakeEventChannel = new FakeEventChannel();
  public readonly restarted: FakeEventChannel = new FakeEventChannel();
  public readonly titleChanged: FakeEventChannel = new FakeEventChannel();
  public readonly cwdChanged: FakeEventChannel = new FakeEventChannel();
  public readonly detached: FakeEventChannel = new FakeEventChannel();
  public readonly closed: FakeEventChannel = new FakeEventChannel();
  public readonly opened: FakeEventChannel = new FakeEventChannel();
  public readonly launchCommandEnded: FakeEventChannel = new FakeEventChannel();
  public readonly runOpened: FakeEventChannel = new FakeEventChannel();
  public readonly runEnded: FakeEventChannel = new FakeEventChannel();
  public readonly renamed: FakeEventChannel = new FakeEventChannel();
  public readonly commandAdded: FakeEventChannel = new FakeEventChannel();
  public readonly database: MemoryModuleDatabase;
  public readonly saved: SavedTerminals;
  public readonly host: TerminalHost;

  public constructor(platform: string = "linux", osRelease: string = "6.8.0", environment: Readonly<Record<string, string | undefined>> = { SHELL: "/bin/bash" },
    environmentSource: IEnvironmentSource = new InheritedEnvironment(environment), historyFolder: TerminalHistoryFolder | null = null,
    database: MemoryModuleDatabase = new MemoryModuleDatabase(SavedTerminals.migrations)) {
    this.database = database;
    this.saved = new SavedTerminals(database, this.log);
    this.fileSystem.files.set("/bin/bash", "");
    this.fileSystem.files.set("C:\\Windows\\System32\\cmd.exe", "");
    this.fileSystem.folders.add("/work");
    this.host = new TerminalHost(
      this.spawner,
      this.fileSystem,
      new ShellIntegration(this.writer, "/tmp", this.log, null, this.settings, platform),
      historyFolder ?? new TerminalHistoryFolder(this.historyWriter, this.fileSystem, this.signaller, "/tmp", 400, this.log),
      new ShellLocator(platform, "x64", environment, null, this.fileSystem, this.runner, this.log),
      platform,
      osRelease,
      environmentSource,
      "/home/a",
      this.log,
      new TerminalEvents(this.output, this.exited, this.restarted, this.titleChanged, this.cwdChanged, this.detached, this.closed, this.opened,
        this.launchCommandEnded, this.runOpened, this.runEnded, this.renamed, this.commandAdded),
      this.saved,
      new CompletionSource(this.fileSystem, this.runner, platform, "/home/a", this.log));
  }

  public static async createAsync(...args: ConstructorParameters<typeof HostFixture>): Promise<HostFixture> {
    const fixture: HostFixture = new HostFixture(...args);
    await fixture.host.handleAsync("terminal.sessions", null, APP);
    return fixture;
  }

  public get process(): FakePtyProcess {
    const process: FakePtyProcess | undefined = this.spawner.spawned.at(-1);
    assert.ok(process !== undefined, "No shell was spawned.");
    return process;
  }

  public async openAsync(open: JsonValue = OPEN): Promise<string> {
    return TerminalReference.fromJson(await this.host.handleAsync("terminal.open", open, APP)).sessionId;
  }

  public reportCwd(process: FakePtyProcess, cwd: string): void {
    const nonce: string = this.writer.nonceFor(this.spawner.environments[this.spawner.spawned.indexOf(process)]);
    process.emitData(`\u001b]6973;P;${nonce};Cwd=${cwd}\u0007$ `);
  }

  public reportPath(process: FakePtyProcess, path: string | null): void {
    const nonce: string = this.writer.nonceFor(this.spawner.environments[this.spawner.spawned.indexOf(process)]);
    process.emitData(`\u001b]6973;P;${nonce};${path === null ? "Path" : `Path=${path}`}\u0007$ `);
  }

  public reportNames(process: FakePtyProcess, names: string | null): void {
    this.reportProperty(process, names === null ? "Names" : `Names=${names}`);
  }

  public reportProperty(process: FakePtyProcess, value: string): void {
    const nonce: string = this.writer.nonceFor(this.spawner.environments[this.spawner.spawned.indexOf(process)]);
    process.emitData(`\u001b]6973;P;${nonce};${value}\u0007$ `);
  }

  public reportOptions(process: FakePtyProcess, isBound: boolean): string {
    const nonce: string = this.writer.nonceFor(this.spawner.environments[this.spawner.spawned.indexOf(process)]);
    process.emitData(`\u001b]6973;P;${nonce};Options=${isBound ? 1 : 0}\u0007\u001b]6973;A;${nonce}\u0007$ \u001b]6973;B;${nonce}\u0007`);
    return nonce;
  }

  public async listAsync(): Promise<readonly TerminalSummary[]> {
    return TerminalSessions.fromJson(await this.host.handleAsync("terminal.sessions", null, APP)).sessions;
  }

  public async notesAsync(count: number): Promise<ReadonlyMap<string, string>> {
    await vi.waitFor(() => assert.equal(this.output.published.length, count));
    return new Map<string, string>(this.output.published.map(t => {
      const output: TerminalOutput = TerminalOutput.fromJson(t);
      return [output.sessionId, output.data];
    }));
  }

  public outputData(): readonly string[] {
    return this.output.published.map(t => TerminalOutput.fromJson(t).data);
  }

  public async endAllAsync(): Promise<void> {
    if (vi.isFakeTimers()) {
      await this.host.endAllAsync();
      return;
    }
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      let isEnded: boolean = false;
      const ending: Promise<void> = this.host.endAllAsync();
      const markEnded: () => void = (): void => {
        isEnded = true;
      };
      void ending.then(markEnded, markEnded);
      const deadline: number = performance.now() + END_GUARD_MS;
      while (!isEnded && performance.now() < deadline)
        await vi.advanceTimersByTimeAsync(END_STEP_MS);
      assert.ok(isEnded, `The host's terminals did not end within ${END_GUARD_MS} ms of real time, advancing the fake clock ${END_STEP_MS} ms at a time.`);
      await ending;
    }
    finally {
      vi.useRealTimers();
    }
  }
}

describe("TerminalHost", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("lists the shells it finds", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();

    assert.deepEqual(await fixture.host.handleAsync("terminal.shells", null, APP), { shells: [{ id: "bash", name: "bash", kind: "Bash", isDefault: true }] });
  });

  it("opens a shell in a folder at a size, as a 256-color terminal, without the host process's own variables", async () => {
    const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", {
      SHELL: "/bin/bash",
      HOME: "/home/a",
      UNSET: undefined,
      TERM: "dumb",
      ELECTRON_RUN_AS_NODE: "1",
      electron_no_attach_console: "1"
    });

    const sessionId: string = await fixture.openAsync();

    assert.match(sessionId, /^[\da-f-]{36}$/u);
    assert.deepEqual(fixture.spawner.calls, ["/bin/bash [--init-file /tmp/noldova-terminal-1/noldova.bash -i] in /work at 80x24"]);
    assert.deepEqual(fixture.spawner.inheritsCursor, [false]);
    const { NOLDOVA_TERMINAL_NONCE_FILE: nonceFile, ...shellEnvironment } = fixture.spawner.environments[0] ?? {};
    assert.match(nonceFile ?? "", /^\/tmp\/noldova-terminal-1\/nonce-[\da-f]{32}$/u);
    assert.match(fixture.writer.nonceFor(fixture.spawner.environments[0]), /^[\da-f]{32}$/u);
    assert.deepEqual(shellEnvironment, { SHELL: "/bin/bash", HOME: "/home/a", TERM: "xterm-256color", COLORTERM: "truecolor", NOLDOVA_TERMINAL_LOGIN: "1" });
    assert.deepEqual(await fixture.host.handleAsync("terminal.sessions", null, APP), {
      sessions: [{ sessionId, shellId: "bash", folder: "/work", title: "", exit: null, isAgentTerminal: false, isPanelTerminal: false, owner: null, opensTab: true, name: null, shellName: "bash", shellKind: "Bash" }]
    });
  });

  it("lists a terminal opened for an owner with its owner", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();

    const sessionId: string = await fixture.openAsync(ownedOpen("example.chat/42"));

    assert.deepEqual(await fixture.host.handleAsync("terminal.sessions", null, APP), {
      sessions: [{ sessionId, shellId: "bash", folder: "/work", title: "", exit: null, isAgentTerminal: false, isPanelTerminal: false,
        owner: "example.chat/42", opensTab: true, name: null, shellName: "bash", shellKind: "Bash" }]
    });
  });

  it("lists a terminal a window's panel opened as the panel's", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();

    const sessionId: string = await fixture.openAsync({ shellId: null, folder: "/work", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, isPanelTerminal: true });

    assert.deepEqual(await fixture.host.handleAsync("terminal.sessions", null, APP), {
      sessions: [{ sessionId, shellId: "bash", folder: "/work", title: "", exit: null, isAgentTerminal: false, isPanelTerminal: true, owner: null, opensTab: true, name: null, shellName: "bash", shellKind: "Bash" }]
    });
  });

  it("answers panel opens while the panel terminal starts, and after, with that one terminal, and a tab's open with its own", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const panelOpen: JsonValue = { shellId: null, folder: "/work", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, isPanelTerminal: true };
    const started: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    fixture.spawner.hold = started.promise;

    const first: Promise<string> = fixture.openAsync(panelOpen);
    await fixture.spawner.held.promise;
    const second: Promise<string> = fixture.openAsync(panelOpen);
    started.resolve();
    const sessionId: string = await first;

    assert.equal(await second, sessionId);
    assert.equal(await fixture.openAsync(panelOpen), sessionId);
    assert.notEqual(await fixture.openAsync(), sessionId);
    assert.equal(fixture.spawner.calls.length, 2);
  });

  it("refuses panel opens that waited on a panel terminal whose shell failed to start, and opens one on the next", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const panelOpen: JsonValue = { shellId: null, folder: "/work", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, isPanelTerminal: true };
    const failure: Error = new Error("no pseudo-terminal");
    fixture.spawner.failure = failure;

    const opens: PromiseSettledResult<string>[] = await Promise.allSettled([fixture.openAsync(panelOpen), fixture.openAsync(panelOpen)]);

    assert.deepEqual(opens, [{ status: "rejected", reason: failure }, { status: "rejected", reason: failure }]);
    assert.equal(fixture.spawner.calls.length, 0);
    assert.deepEqual(fixture.writer.removedFiles, [...fixture.writer.files.keys()].filter(t => path.basename(t).startsWith("nonce-")));
    assert.notEqual(fixture.writer.removedFiles.length, 0);
    fixture.spawner.failure = null;
    const sessionId: string = await fixture.openAsync(panelOpen);
    assert.deepEqual((TerminalSessions.fromJson(await fixture.host.handleAsync("terminal.sessions", null, APP))).sessions.map(t => t.sessionId), [sessionId]);
  });

  it("opens the default shell in the home folder when the pane names neither", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    fixture.fileSystem.folders.add("/home/a");

    await fixture.openAsync({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 });

    assert.match(fixture.spawner.calls[0] ?? "", /^\/bin\/bash .* in \/home\/a at 80x24$/u);
  });

  it("lists to the app an agent session's terminal with an owner as an agent terminal, but not one without, which no window shows", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const size: TerminalSize = new TerminalSize(80, 24);

    const sessionId: string = (await fixture.host.openTerminalAsync(null, "/work", size, "agent-1", 104_857_600, null, false, "example.chat/42"))
      .session.sessionId;
    await fixture.host.openTerminalAsync(null, "/work", size, "agent-2");

    assert.deepEqual(await fixture.host.handleAsync("terminal.sessions", null, APP), {
      sessions: [{ sessionId, shellId: "bash", folder: "/work", title: "", exit: null, isAgentTerminal: true, isPanelTerminal: false,
        owner: "example.chat/42", opensTab: true, name: null, shellName: "bash", shellKind: "Bash" }]
    });
  });

  it("starts each shell and one-shot command from the environment as it reads at that moment", async () => {
    const reads: Readonly<Record<string, string | undefined>>[] = [
      { SHELL: "/bin/bash", GREETING: "first" },
      { SHELL: "/bin/bash", GREETING: "second", ELECTRON_RUN_AS_NODE: "1" },
      { SHELL: "/bin/bash", GREETING: "third" }
    ];
    const source: IEnvironmentSource = { start: () => undefined, readAsync: () => Promise.resolve(reads.shift() ?? {}), end: () => undefined };
    const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash" }, source);

    await fixture.openAsync();
    await fixture.openAsync();
    await fixture.host.spawnAsync("/bin/sh", ["-c", "true"], "/work", new TerminalSize(80, 24), { GREETING: "own" });
    await fixture.host.spawnAsync("/bin/sh", ["-c", "true"], "/work", new TerminalSize(80, 24));

    assert.deepEqual(fixture.spawner.environments.map(t => [t["GREETING"], t["ELECTRON_RUN_AS_NODE"], t["TERM"]]), [
      ["first", undefined, "xterm-256color"],
      ["second", undefined, "xterm-256color"],
      ["own", undefined, "xterm-256color"],
      [undefined, undefined, "xterm-256color"]
    ]);
  });

  for (const [failure, reason] of [[new Error("busy"), "busy"], ["gone", "gone"]] as const) {
    it(`logs shell integration scripts it can't remove when it ends, and ends anyway (${reason})`, async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      await fixture.openAsync();
      fixture.writer.removalFailure = failure;

      await fixture.endAllAsync();

      assert.equal(fixture.process.ends, 1);
      assert.deepEqual(fixture.log.messages, [`The module's shell integration scripts could not be removed: ${reason}`]);
    });
  }

  it("refuses an open after it ended", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    await fixture.endAllAsync();

    await assert.rejects(fixture.openAsync(), HostEndedException);

    assert.deepEqual(fixture.spawner.spawned, []);
  });

  it("refuses an open that is still reading its environment when it ends, and starts no shell", async () => {
    const asked: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    const read: PromiseWithResolvers<Readonly<Record<string, string | undefined>>> = Promise.withResolvers<Readonly<Record<string, string | undefined>>>();
    const source: IEnvironmentSource = {
      start: () => undefined,
      readAsync: () => {
        asked.resolve();
        return read.promise;
      },
      end: () => undefined
    };
    const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash" }, source);
    const opening: Promise<string> = fixture.openAsync();
    await asked.promise;

    await fixture.endAllAsync();
    read.resolve({ SHELL: "/bin/bash" });

    await assert.rejects(opening, HostEndedException);
    assert.deepEqual(fixture.spawner.spawned, []);
    assert.deepEqual(await fixture.host.handleAsync("terminal.sessions", null, APP), { sessions: [] });
  });

  it("removes the nonce file of a shell that exits before its first mark, and leaves it to the script while the shell runs", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    await fixture.openAsync();
    const nonceFile: string = fixture.spawner.environments[0]?.["NOLDOVA_TERMINAL_NONCE_FILE"] ?? "";
    fixture.spawner.spawned[0]?.emitData("bash: warning: setlocale: LC_ALL: cannot change locale\r\n");
    assert.deepEqual(fixture.writer.removedFiles, []);

    fixture.spawner.spawned[0]?.exit(1);

    await vi.waitFor(() => assert.deepEqual(fixture.writer.removedFiles.map(t => t.replaceAll("\\", "/")), [nonceFile]));
  });

  for (const isEndable of [true, false]) {
    it(`ends a shell that started as it ended${isEndable ? "" : ", and logs one that stays"}`, async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const release: PromiseWithResolvers<void> = Promise.withResolvers<void>();
      fixture.spawner.hold = release.promise;
      fixture.spawner.isEndable = isEndable;
      const opening: Promise<string> = fixture.openAsync();
      await fixture.spawner.held.promise;

      await fixture.endAllAsync();
      release.resolve();

      await assert.rejects(opening, HostEndedException);
      assert.equal(fixture.spawner.spawned[0]?.ends, 1);
      assert.equal(fixture.writer.removedFiles.length, 1);
      assert.deepEqual(fixture.log.messages, isEndable ? [] : ["A shell that started as the terminals ended, process 1000, or a process it started, did not end in time."]);
      assert.deepEqual(await fixture.host.handleAsync("terminal.sessions", null, APP), { sessions: [] });
    });
  }

  it("refuses a shell it does not know, as NotFound, so the window can fall back to the default shell", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();

    await assert.rejects(fixture.openAsync({ shellId: "zsh", folder: "/work", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 }),
      (error: unknown) => error instanceof ShellNotFoundException && error.shellId === "zsh" && error.message === "No shell has the id zsh."
        && error.failure.code === FailureCode.NotFound);
  });

  it("opens a pane's folder that does not exist in the home folder, and says so in the log and the terminal's first line", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    fixture.fileSystem.folders.add("/home/a");

    const sessionId: string = await fixture.openAsync({ shellId: "bash", folder: "/gone\u001b[2J", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 });

    assert.match(fixture.spawner.calls[0] ?? "", / in \/home\/a at 80x24$/u);
    assert.deepEqual(fixture.spawner.inheritsCursor, [true]);
    assert.deepEqual(fixture.log.messages, [`Terminal ${sessionId} opened in /home/a, since the folder /gone\u001b[2J does not exist.`]);
    await vi.waitFor(() => assert.equal(fixture.output.published.length, 1));
    assert.equal(fixture.outputData()[0],
      "\u001b[2;3mThe folder /gone?[2J does not exist, so this terminal opened in the home folder.\u001b[0m\r\n");
  });

  it("logs, naming the terminal and the reason, a started command it could not keep", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionId: string = await fixture.openAsync();
    const nonce: string = fixture.writer.nonceFor(fixture.spawner.environments[fixture.spawner.spawned.indexOf(fixture.process)]);
    const stopRefusing: () => void = fixture.commandAdded.listen(() => {
      throw new Error("The window went away.");
    });
    const written: Promise<string> = new Promise<string>(resolve => fixture.log.answer("write", t => resolve(t)));

    fixture.process.emitData(`\u001b]6973;A;${nonce}\u0007$ \u001b]6973;B;${nonce}\u0007ls -la`);
    fixture.process.emitData(`\r\n\u001b]6973;C;${nonce}\u0007`);

    assert.equal(await written, `The command started in terminal ${sessionId} could not be kept: The window went away.`);
    stopRefusing();
    await fixture.endAllAsync();
  });

  it("has a Windows shell with an integration print a terminal's note, handed to it as a variable, and start from the top of the screen",
    async () => {
      const fixture: HostFixture = await HostFixture.createAsync("win32", "10.0.26100", { SystemRoot: "C:\\Windows" });
      fixture.fileSystem.files.set("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", "");
      fixture.fileSystem.folders.add("/home/a");

      await fixture.openAsync({ shellId: "powershell", folder: "C:\\gone `$(x)'\u001b[2J", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 });
      fixture.process.emitData("PS> ");

      assert.deepEqual(fixture.spawner.inheritsCursor, [false]);
      assert.equal(fixture.spawner.environments[0]?.["NOLDOVA_TERMINAL_NOTE"],
        "\u001b[2;3mThe folder C:\\gone `$(x)'?[2J does not exist, so this terminal opened in the home folder.\u001b[0m\r\n");
      await vi.waitFor(() => assert.equal(fixture.output.published.length, 1));
      assert.equal(fixture.outputData()[0], "PS> ");
    });

  it("has a Command Prompt print a terminal's note, handed to it as a variable, and start from the top of the screen", async () => {
    const fixture: HostFixture = await HostFixture.createAsync("win32", "10.0.26100", { SystemRoot: "C:\\Windows" });
    fixture.fileSystem.folders.add("/home/a");

    await fixture.openAsync({ shellId: "cmd", folder: "C:\\gone & x", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 });
    fixture.process.emitData("C:\\> ");

    assert.deepEqual(fixture.spawner.inheritsCursor, [false]);
    assert.equal(fixture.spawner.environments[0]?.["NOLDOVA_TERMINAL_NOTE"],
      "\u001b[2;3mThe folder C:\\gone & x does not exist, so this terminal opened in the home folder.\u001b[0m");
    assert.match(fixture.spawner.calls[0] ?? "", /^C:\\Windows\\System32\\cmd\.exe \[\/s \/k ""C:\\Windows\\System32\\cmd\.exe" \/d \/v:on /u);
    await vi.waitFor(() => assert.equal(fixture.output.published.length, 1));
    assert.equal(fixture.outputData()[0], "C:\\> ");
  });

  it("starts the shell of a terminal opened with a note below the note, and its restarted shell from the top of the screen", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    fixture.fileSystem.folders.add("/home/a");
    const sessionId: string = await fixture.openAsync({ shellId: "bash", folder: "/gone", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 });

    assert.equal(await fixture.host.handleAsync("terminal.restart", { sessionId, size: { cols: 80, rows: 24 } }, APP), null);

    assert.deepEqual(fixture.spawner.inheritsCursor, [true, false]);
  });

  it("refuses an agent's folder that does not exist", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();

    await assert.rejects(fixture.host.openTerminalAsync(null, "/gone", new TerminalSize(80, 24), "agent-1"), FolderNotFoundException);
    assert.deepEqual(fixture.spawner.calls, []);
  });

  it("refuses a pane's relative folder", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();

    await assert.rejects(fixture.openAsync({ shellId: "bash", folder: "work", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 }), /The value must be an absolute path\. \(Parameter 'folder'\)/u);
    assert.deepEqual(fixture.spawner.calls, []);
  });

  it("refuses a malformed request and an unknown method", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();

    await assert.rejects(fixture.host.handleAsync("terminal.input", { sessionId: "s1" }, APP), JsonException);
    await assert.rejects(fixture.host.handleAsync("terminal.unknown", null, APP), UnknownMethodException);
  });

  it("refuses a session it does not have", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();

    await assert.rejects(fixture.host.handleAsync("terminal.input", { sessionId: "s9", data: "x" }, APP), SessionNotFoundException);
  });

  it("routes input, resizes, attachments and acknowledgements to the session", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionId: string = await fixture.openAsync();

    assert.equal(await fixture.host.handleAsync("terminal.input", { sessionId, data: "ls\r" }, APP), null);
    assert.equal(await fixture.host.handleAsync("terminal.resize", { sessionId, size: { cols: 100, rows: 30 } }, APP), null);
    const attachment: TerminalAttachment = TerminalAttachment.fromJson(await fixture.host.handleAsync("terminal.attach", { sessionId, paneId: "p1" }, APP));
    assert.equal(await fixture.host.handleAsync("terminal.ack", { sessionId, paneId: "p1", offset: 0 }, APP), null);
    assert.equal(await fixture.host.handleAsync("terminal.visibility", { sessionId, paneId: "p1", visible: false }, APP), null);
    assert.equal(await fixture.host.handleAsync("terminal.detach", { sessionId, paneId: "p1" }, APP), null);

    assert.deepEqual(fixture.process.writes, ["ls\r"]);
    assert.deepEqual(fixture.process.sizes, ["100x30", "100x29", "100x30"]);
    assert.equal(attachment.sessionId, sessionId);
    assert.equal(attachment.windowsPty, null);
  });

  it("publishes output, titles and the exit", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionId: string = await fixture.openAsync();

    fixture.process.emitData("\u001b]0;top\u0007hi");
    await vi.waitFor(() => assert.equal(fixture.titleChanged.published.length, 1));
    fixture.process.exit(0);

    assert.deepEqual(fixture.titleChanged.published, [{ sessionId, title: "top" }]);
    assert.deepEqual(fixture.output.published, [{ sessionId, offset: 0, data: "\u001b]0;top\u0007hi", stored: { start: 0, end: 0, dropped: 0 }, inputs: [] }]);
    assert.deepEqual(fixture.exited.published, [{ sessionId, exit: { exitCode: 0, endedBy: "Exit" } }]);
  });

  it("names a terminal for its tabs, tells its windows, keeps the name through the program's titles and in its saved row, and clears it", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionId: string = await fixture.openAsync();

    assert.equal(await fixture.host.handleAsync("terminal.rename", { sessionId, name: "Server" }, APP), null);
    fixture.process.emitData("]0;vim");
    await vi.waitFor(() => assert.equal(fixture.titleChanged.published.length, 1));

    assert.deepEqual(fixture.renamed.published, [{ sessionId, name: "Server" }]);
    assert.deepEqual(await fixture.listAsync(), [new TerminalSummary(sessionId, "bash", "/work", "vim", null, false, false, null, true, "Server", "bash", TerminalShellKind.Bash)]);
    assert.deepEqual(fixture.saved.list(), [new SavedTerminal(sessionId, "bash", "/work", false, null, true, "Server")]);

    await fixture.host.handleAsync("terminal.rename", { sessionId, name: null }, APP);

    assert.deepEqual(fixture.renamed.published, [{ sessionId, name: "Server" }, { sessionId, name: null }]);
    assert.equal((await fixture.listAsync())[0]?.name, null);
    assert.equal(fixture.saved.list()[0]?.name, null);
  });

  it("refuses to rename a session it does not have, and a blank or too long name, and keeps the name it has", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionId: string = await fixture.openAsync();
    await fixture.host.handleAsync("terminal.rename", { sessionId, name: "Server" }, APP);

    await assert.rejects(fixture.host.handleAsync("terminal.rename", { sessionId: "s9", name: "Build" }, APP), SessionNotFoundException);
    await assert.rejects(fixture.host.handleAsync("terminal.rename", { sessionId, name: "  " }, APP), JsonException);
    await assert.rejects(fixture.host.handleAsync("terminal.rename", { sessionId, name: "x".repeat(4_097) }, APP), JsonException);

    assert.equal((await fixture.listAsync())[0]?.name, "Server");
    assert.equal(fixture.renamed.published.length, 1);
  });

  it("completes the shell's line in the folder its integration last reported, else the one it started in, from the shell's PATH", async () => {
    const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash", PATH: "/usr/bin" });
    fixture.fileSystem.files.set("/work/setup.sh", "");
    fixture.fileSystem.folders.add("/work/src");
    fixture.fileSystem.files.set("/work/src/main.ts", "");
    fixture.fileSystem.files.set("/usr/bin/grep", "");
    const sessionId: string = await fixture.openAsync();
    const completeAsync = (line: string): Promise<JsonValue> => fixture.host.handleAsync("terminal.complete", { sessionId, line, cursor: line.length }, APP);

    assert.deepEqual(await completeAsync("cat s"), { replaceFrom: 4, isShellTab: false, items: [
      { text: "setup.sh", label: "setup.sh", kind: "File" },
      { text: "src/", label: "src/", kind: "Folder" }
    ] });
    assert.deepEqual(await completeAsync("gr"), { replaceFrom: 0, isShellTab: false, items: [{ text: "grep", label: "grep", kind: "Command" }] });
    fixture.reportCwd(fixture.process, "/work/src");
    assert.deepEqual(await completeAsync("cat m"), { replaceFrom: 4, isShellTab: false, items: [{ text: "main.ts", label: "main.ts", kind: "File" }] });
  });

  it("completes commands from the PATH the shell reported at its last prompt that did, over the one it started with", async () => {
    const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash", PATH: "/usr/bin" });
    fixture.fileSystem.files.set("/usr/bin/grep", "");
    fixture.fileSystem.files.set("/work/.venv/bin/grepx", "");
    const sessionId: string = await fixture.openAsync();
    const completeAsync = (): Promise<JsonValue> => fixture.host.handleAsync("terminal.complete", { sessionId, line: "gr", cursor: 2 }, APP);

    fixture.reportPath(fixture.process, "/work/.venv/bin:/usr/bin");
    fixture.reportCwd(fixture.process, "/work");
    assert.deepEqual(await completeAsync(), { replaceFrom: 0, isShellTab: false, items: [
      { text: "grep", label: "grep", kind: "Command" },
      { text: "grepx", label: "grepx", kind: "Command" }
    ] });
    fixture.reportPath(fixture.process, "/usr/bin");
    assert.deepEqual(await completeAsync(), { replaceFrom: 0, isShellTab: false, items: [{ text: "grep", label: "grep", kind: "Command" }] });
  });

  it("completes the aliases, functions, builtins and keywords the shell reported at its last prompt, and none of them before", async () => {
    const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash", PATH: "/usr/bin" });
    const sessionId: string = await fixture.openAsync();
    const completeAsync = async (): Promise<readonly string[]> =>
      TerminalCompletion.fromJson(await fixture.host.handleAsync("terminal.complete", { sessionId, line: "gr", cursor: 2 }, APP)).items.map(t => t.label);

    const before: readonly string[] = await completeAsync();
    fixture.reportNames(fixture.process, "greet _greet_helper cd");

    assert.deepEqual([before, await completeAsync()], [[], ["greet"]]);
  });

  it("completes the builtins and keywords a shell reported apart, with no names, as an older Git Bash sends, and after a names reset", async () => {
    const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash", PATH: "/usr/bin" });
    const sessionId: string = await fixture.openAsync();
    const completeAsync = async (): Promise<readonly string[]> =>
      TerminalCompletion.fromJson(await fixture.host.handleAsync("terminal.complete", { sessionId, line: "c", cursor: 1 }, APP)).items.map(t => t.label);

    fixture.reportProperty(fixture.process, "Builtins=cd case export");
    const reported: readonly string[] = await completeAsync();
    fixture.reportNames(fixture.process, null);

    assert.deepEqual([reported, await completeAsync()], [["case", "cd"], ["case", "cd"]]);
  });

  it("completes commands from the start PATH again once the shell resets its PATH, as when it can't send it, and from none for an empty one", async () => {
    const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash", PATH: "/usr/bin" });
    fixture.fileSystem.files.set("/usr/bin/grep", "");
    fixture.fileSystem.files.set("/work/.venv/bin/grepx", "");
    const sessionId: string = await fixture.openAsync();
    const completeAsync = async (): Promise<readonly string[]> =>
      TerminalCompletion.fromJson(await fixture.host.handleAsync("terminal.complete", { sessionId, line: "gr", cursor: 2 }, APP)).items.map(t => t.label);

    fixture.reportPath(fixture.process, "/work/.venv/bin");
    const reported: readonly string[] = await completeAsync();
    fixture.reportPath(fixture.process, null);
    const reset: readonly string[] = await completeAsync();
    fixture.reportPath(fixture.process, "");

    assert.deepEqual([reported, reset, await completeAsync()], [["grepx"], ["grep"], []]);
  });

  it("completes a Windows terminal's commands from its reported PATH, in place of the start Path whatever its case", async () => {
    const fixture: HostFixture = await HostFixture.createAsync("win32", "10.0.26100", { SystemRoot: "C:\\Windows", Path: "C:\\Windows", PATHEXT: ".EXE;.CMD" });
    fixture.fileSystem.files.set("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", "");
    fixture.fileSystem.folders.add("C:\\work");
    fixture.fileSystem.files.set("C:\\Windows\\zzcmd.exe", "");
    fixture.fileSystem.files.set("C:\\tools\\zztool.cmd", "");
    const sessionId: string = await fixture.openAsync({ shellId: "powershell", folder: "C:\\work", size: SIZE, storedLimit: 104_857_600 });
    const completeAsync = (): Promise<JsonValue> => fixture.host.handleAsync("terminal.complete", { sessionId, line: "zz", cursor: 2 }, APP);

    assert.deepEqual(await completeAsync(), { replaceFrom: 0, isShellTab: false, items: [{ text: "zzcmd", label: "zzcmd", kind: "Command" }] });
    fixture.reportPath(fixture.process, "C:\\tools\\x3bC:\\Windows");
    assert.deepEqual(await completeAsync(), { replaceFrom: 0, isShellTab: false, items: [
      { text: "zzcmd", label: "zzcmd", kind: "Command" },
      { text: "zztool", label: "zztool", kind: "Command" }
    ] });
  });

  it("adds the command's options the shell's own completers give when the person pressed a key to complete, among its files", async () => {
    const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/zsh", PATH: "/usr/bin" });
    fixture.fileSystem.files.set("/bin/zsh", "");
    fixture.fileSystem.files.set("/work/--and.txt", "");
    const sessionId: string = await fixture.openAsync(ZSH_OPEN);
    const nonce: string = fixture.reportOptions(fixture.process, true);
    fixture.process.answers.set("\u001b[24;7~", `\u001b]6973;O;${nonce};--author;--all;--all;-x;--a\\x3bb\u0007`);

    const completion: JsonValue = await fixture.host.handleAsync("terminal.complete", { sessionId, line: "ls --a", cursor: 6, asksShell: true }, APP);

    assert.deepEqual(completion, { replaceFrom: 3, isShellTab: false, items: [
      { text: "--a;b", label: "--a;b", kind: "Option" },
      { text: "--all", label: "--all", kind: "Option" },
      { text: "--and.txt", label: "--and.txt", kind: "File" },
      { text: "--author", label: "--author", kind: "Option" }
    ] });
    assert.deepEqual(fixture.process.writes, ["\u001b[24;7~"]);
  });

  it("asks the shell nothing for a command's first word, for a list the person didn't ask for, or while its prompt says the binding isn't in place", async () => {
    const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/zsh", PATH: "/usr/bin" });
    fixture.fileSystem.files.set("/bin/zsh", "");
    fixture.fileSystem.files.set("/usr/bin/grep", "");
    const sessionId: string = await fixture.openAsync(ZSH_OPEN);
    const completeAsync = (line: string, asksShell: boolean): Promise<JsonValue> =>
      fixture.host.handleAsync("terminal.complete", { sessionId, line, cursor: line.length, asksShell }, APP);

    const beforePrompt: JsonValue = await completeAsync("ls -", true);
    fixture.reportOptions(fixture.process, true);
    const firstWord: JsonValue = await completeAsync("gr", true);
    const unasked: JsonValue = await completeAsync("ls -", false);
    fixture.reportOptions(fixture.process, false);
    const unbound: JsonValue = await completeAsync("ls -", true);

    assert.deepEqual([beforePrompt, firstWord, unasked, unbound], [
      { replaceFrom: 3, isShellTab: false, items: [] },
      { replaceFrom: 0, isShellTab: false, items: [{ text: "grep", label: "grep", kind: "Command" }] },
      { replaceFrom: 3, isShellTab: false, items: [] },
      { replaceFrom: 3, isShellTab: false, items: [] }
    ]);
    assert.deepEqual(fixture.process.writes, []);
  });

  it("asks bash nothing, even at a prompt that says a binding is in place, since bash gets none", async () => {
    const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash", PATH: "/usr/bin" });
    const sessionId: string = await fixture.openAsync();
    fixture.reportOptions(fixture.process, true);

    const completion: JsonValue = await fixture.host.handleAsync("terminal.complete", { sessionId, line: "ls -", cursor: 4, asksShell: true }, APP);

    assert.deepEqual(completion, { replaceFrom: 3, isShellTab: false, items: [] });
    assert.deepEqual(fixture.process.writes, []);
  });

  it("gives the shell a plain Tab and no list when its completers don't answer in time, and drops their late answer", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/zsh", PATH: "/usr/bin" });
      fixture.fileSystem.files.set("/bin/zsh", "");
      const sessionId: string = await fixture.openAsync(ZSH_OPEN);
      const nonce: string = fixture.reportOptions(fixture.process, true);
      const completeAsync = (): Promise<JsonValue> =>
        fixture.host.handleAsync("terminal.complete", { sessionId, line: "ls -", cursor: 4, asksShell: true }, APP);

      const late: Promise<JsonValue> = completeAsync();
      await vi.advanceTimersByTimeAsync(2_000);
      const timedOut: JsonValue = await late;
      fixture.process.answers.set("\u001b[24;7~", `\u001b]6973;O;${nonce};--late\u0007\u001b]6973;O;${nonce};--long\u0007`);
      const answered: JsonValue = await completeAsync();

      assert.deepEqual([timedOut, answered], [
        { replaceFrom: 4, isShellTab: true, items: [] },
        { replaceFrom: 3, isShellTab: false, items: [{ text: "--long", label: "--long", kind: "Option" }] }
      ]);
      assert.deepEqual(fixture.process.writes, ["\u001b[24;7~", "\t", "\u001b[24;7~"]);
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("finds which typed names the shell wouldn't, from the names and PATH its last prompts reported, and none before, after a names reset or while its PATH is reset", async () => {
    const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash", PATH: "/usr/bin" });
    fixture.fileSystem.files.set("/usr/bin/grep", "");
    fixture.fileSystem.files.set("/work/.venv/bin/pytest", "");
    const sessionId: string = await fixture.openAsync();
    const findAsync = async (): Promise<readonly string[]> =>
      TerminalMissingCommands.fromJson(await fixture.host.handleAsync("terminal.findCommands", { sessionId, names: ["grep", "pytest", "ll", "gti"] }, APP)).names;

    const before: readonly string[] = await findAsync();
    fixture.reportNames(fixture.process, "ll la");
    const reported: readonly string[] = await findAsync();
    fixture.reportPath(fixture.process, "/work/.venv/bin:/usr/bin");
    const pathed: readonly string[] = await findAsync();
    fixture.reportPath(fixture.process, null);
    const reset: readonly string[] = await findAsync();
    fixture.reportPath(fixture.process, "/usr/bin");
    const repathed: readonly string[] = await findAsync();
    fixture.reportNames(fixture.process, null);

    assert.deepEqual([before, reported, pathed, reset, repathed, await findAsync()], [[], ["pytest", "gti"], ["gti"], [], ["pytest", "gti"], []]);
  });

  it("looks a PowerShell terminal's typed names up in its own program, with the PATH and PSModulePath its last prompts reported", async () => {
    const powerShell: string = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
    const fixture: HostFixture = await HostFixture.createAsync("win32", "10.0.26100", { SystemRoot: "C:\\Windows", Path: "C:\\Windows", PATHEXT: ".EXE", PSModulePath: "C:\\Modules" });
    fixture.fileSystem.files.set(powerShell, "");
    fixture.fileSystem.folders.add("C:\\work");
    fixture.runner.answers.set(powerShell, "0\r\n");
    const sessionId: string = await fixture.openAsync({ shellId: "powershell", folder: "C:\\work", size: SIZE, storedLimit: 104_857_600 });
    const findAsync = async (): Promise<readonly string[]> =>
      TerminalMissingCommands.fromJson(await fixture.host.handleAsync("terminal.findCommands", { sessionId, names: ["gti", "ll"] }, APP)).names;
    const before: readonly string[] = await findAsync();
    fixture.reportNames(fixture.process, "ll");
    fixture.reportPath(fixture.process, "C:\\tools");
    const nonce: string = fixture.writer.nonceFor(fixture.spawner.environments[fixture.spawner.spawned.indexOf(fixture.process)]);
    fixture.process.emitData(`\u001b]6973;P;${nonce};ModulePath=C:\\x5cMine\u0007PS> `);

    const found: readonly string[] = await findAsync();
    const runs: number = fixture.runner.runs.length;
    const environment: Readonly<Record<string, string>> = fixture.runner.environments.at(-1) ?? {};

    assert.deepEqual([before, found, await findAsync(), fixture.runner.runs.length], [[], ["gti"], ["gti"], runs]);
    assert.deepEqual([fixture.runner.runs.at(-1)?.[0], environment["PATH"], environment["PATHEXT"], environment["PSModulePath"]],
      [powerShell, "C:\\tools", ".EXE", "C:\\Mine"]);
  });

  it("completes in Git Bash's /tmp as the folder the shell reported for it, in place of the TEMP it started with", async () => {
    const fixture: HostFixture = await HostFixture.createAsync("win32", "10.0.26100", { SystemRoot: "C:\\Windows", ProgramFiles: "C:\\Program Files", TEMP: "C:\\Temp" });
    fixture.fileSystem.files.set("C:\\Program Files\\Git\\bin\\bash.exe", "");
    fixture.fileSystem.folders.add("C:\\work");
    fixture.fileSystem.files.set("C:\\Temp\\names\\started.txt", "");
    fixture.fileSystem.files.set("C:\\msys\\tmp\\names\\reported.txt", "");
    const sessionId: string = await fixture.openAsync({ shellId: "git-bash", folder: "C:\\work", size: SIZE, storedLimit: 104_857_600 });
    const completeAsync = async (): Promise<readonly string[]> =>
      TerminalCompletion.fromJson(await fixture.host.handleAsync("terminal.complete", { sessionId, line: "cat ", cursor: 4 }, APP)).items.map(t => t.label);
    fixture.reportCwd(fixture.process, "/tmp/names");
    const started: readonly string[] = await completeAsync();
    const nonce: string = fixture.writer.nonceFor(fixture.spawner.environments[fixture.spawner.spawned.indexOf(fixture.process)]);
    fixture.process.emitData(`\u001b]6973;P;${nonce};Temp=C:\\x5cmsys\\x5ctmp\u0007$ `);

    assert.deepEqual([started, await completeAsync()], [["started.txt"], ["reported.txt"]]);
  });

  it("completes in Git Bash's /tmp as the TEMP it started with while it reports none, though the environment reads another since, as the app's own when the Windows environment can't be read, and as the TEMP a restart started with", async () => {
    let read: Readonly<Record<string, string | undefined>> = { SystemRoot: "C:\\Windows", ProgramFiles: "C:\\Program Files", TEMP: "C:\\Temp" };
    const source: IEnvironmentSource = { start: () => undefined, readAsync: () => Promise.resolve(read), end: () => undefined };
    const fixture: HostFixture = await HostFixture.createAsync("win32", "10.0.26100", read, source);
    fixture.fileSystem.files.set("C:\\Program Files\\Git\\bin\\bash.exe", "");
    fixture.fileSystem.folders.add("C:\\work");
    fixture.fileSystem.files.set("C:\\Temp\\names\\started.txt", "");
    fixture.fileSystem.files.set("C:\\App\\Temp\\names\\app.txt", "");
    const sessionId: string = await fixture.openAsync({ shellId: "git-bash", folder: "C:\\work", size: SIZE, storedLimit: 104_857_600 });
    fixture.reportCwd(fixture.process, "/tmp/names");
    const completeAsync = async (): Promise<readonly string[]> =>
      TerminalCompletion.fromJson(await fixture.host.handleAsync("terminal.complete", { sessionId, line: "cat ", cursor: 4 }, APP)).items.map(t => t.label);
    read = { ...read, TEMP: "C:\\App\\Temp" };
    const started: readonly string[] = await completeAsync();
    fixture.process.exit(0);
    await fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP);
    fixture.reportCwd(fixture.process, "/tmp/names");

    assert.deepEqual([started, await completeAsync()], [["started.txt"], ["app.txt"]]);
    await fixture.endAllAsync();
  });

  it("finds no PowerShell name missing while its PSModulePath is reset, and looks up again once the shell reports one", async () => {
    const powerShell: string = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
    const fixture: HostFixture = await HostFixture.createAsync("win32", "10.0.26100", { SystemRoot: "C:\\Windows", Path: "C:\\Windows", PATHEXT: ".EXE", PSModulePath: "C:\\Modules" });
    fixture.fileSystem.files.set(powerShell, "");
    fixture.fileSystem.folders.add("C:\\work");
    fixture.runner.answers.set(powerShell, "0\r\n");
    const sessionId: string = await fixture.openAsync({ shellId: "powershell", folder: "C:\\work", size: SIZE, storedLimit: 104_857_600 });
    const findAsync = async (): Promise<readonly string[]> =>
      TerminalMissingCommands.fromJson(await fixture.host.handleAsync("terminal.findCommands", { sessionId, names: ["gti"] }, APP)).names;
    const nonce: string = fixture.writer.nonceFor(fixture.spawner.environments[fixture.spawner.spawned.indexOf(fixture.process)]);
    fixture.reportNames(fixture.process, "ll");
    fixture.process.emitData(`\u001b]6973;P;${nonce};ModulePath\u0007PS> `);
    const runs: number = fixture.runner.runs.length;
    const reset: readonly string[] = await findAsync();
    const unasked: boolean = fixture.runner.runs.length === runs;
    fixture.process.emitData(`\u001b]6973;P;${nonce};ModulePath=C:\\x5cMine\u0007PS> `);

    assert.deepEqual([reset, unasked, await findAsync(), fixture.runner.environments.at(-1)?.["PSModulePath"]], [[], true, ["gti"], "C:\\Mine"]);
    assert.deepEqual(fixture.log.callsOf("write").map(t => t[0]).filter(t => String(t).startsWith("PowerShell's lookup")),
      ["PowerShell's lookup of the names a command line runs is skipped, since the session's PSModulePath was reset, so every name counts as found."]);
  });

  it("lists PATH's programs again for a restarted terminal's shell, whose prompts count from the start again", async () => {
    const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash", PATH: "/usr/bin" });
    const sessionId: string = await fixture.openAsync();
    const findAsync = async (): Promise<readonly string[]> =>
      TerminalMissingCommands.fromJson(await fixture.host.handleAsync("terminal.findCommands", { sessionId, names: ["gti"] }, APP)).names;
    fixture.reportNames(fixture.process, "ll");
    const before: readonly string[] = await findAsync();
    fixture.fileSystem.files.set("/usr/bin/gti", "");
    const kept: readonly string[] = await findAsync();
    fixture.process.exit(0);

    await fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP);
    fixture.reportNames(fixture.process, "ll");

    assert.deepEqual([before, kept, await findAsync()], [["gti"], ["gti"], []]);
  });

  it("refuses to find names for a session it does not have, a closed one and too many names, reading nothing for them", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionId: string = await fixture.openAsync();
    const closed: string = await fixture.openAsync();
    await fixture.host.handleAsync("terminal.close", { sessionId: closed }, APP);
    const listed: readonly string[] = [...fixture.fileSystem.listed];

    await assert.rejects(fixture.host.handleAsync("terminal.findCommands", { sessionId: "s9", names: ["ls"] }, APP), SessionNotFoundException);
    await assert.rejects(fixture.host.handleAsync("terminal.findCommands", { sessionId: closed, names: ["ls"] }, APP), SessionNotFoundException);
    await assert.rejects(fixture.host.handleAsync("terminal.findCommands", { sessionId, names: Array.from({ length: 65 }, () => "ls") }, APP),
      JsonException);
    assert.deepEqual(fixture.fileSystem.listed, listed);
  });

  it("refuses to complete a session it does not have, a closed one and a cursor past the line, reading nothing for them", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionId: string = await fixture.openAsync();
    const closed: string = await fixture.openAsync();
    await fixture.host.handleAsync("terminal.close", { sessionId: closed }, APP);
    const listed: readonly string[] = [...fixture.fileSystem.listed];

    await assert.rejects(fixture.host.handleAsync("terminal.complete", { sessionId: "s9", line: "ls", cursor: 2 }, APP), SessionNotFoundException);
    await assert.rejects(fixture.host.handleAsync("terminal.complete", { sessionId: closed, line: "cat ", cursor: 4 }, APP), SessionNotFoundException);
    await assert.rejects(fixture.host.handleAsync("terminal.complete", { sessionId, line: "ls", cursor: 3 }, APP), JsonException);
    assert.deepEqual(fixture.fileSystem.listed, listed);
  });

  it("publishes the working folder the shell's integration reports", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionId: string = await fixture.openAsync();
    const nonce: string = fixture.writer.nonceFor(fixture.spawner.environments[0]);

    fixture.process.emitData(`\u001b]6973;P;${nonce};Cwd=/work/src\u0007$ `);

    assert.deepEqual(fixture.cwdChanged.published, [{ sessionId, cwd: "/work/src" }]);
  });

  it("publishes the detachment of a pane that stays over 1 MiB behind", async () => {
    vi.useFakeTimers();
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionId: string = await fixture.openAsync();

    const attaching: Promise<JsonValue> = fixture.host.handleAsync("terminal.attach", { sessionId, paneId: "p1" }, APP);
    await vi.advanceTimersByTimeAsync(0);
    await attaching;
    fixture.process.emitData("\r".repeat(1_048_577));
    await vi.advanceTimersByTimeAsync(10_000);

    assert.deepEqual(fixture.detached.published, [{ sessionId, paneId: "p1" }]);
    await fixture.endAllAsync();
  });

  it("closes a session by ending its shell and forgetting it", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionId: string = await fixture.openAsync();

    assert.equal(await fixture.host.handleAsync("terminal.close", { sessionId }, APP), null);

    assert.equal(fixture.process.ends, 1);
    assert.deepEqual(fixture.exited.published, [{ sessionId, exit: { exitCode: null, endedBy: "Close" } }]);
    assert.deepEqual(await fixture.host.handleAsync("terminal.sessions", null, APP), { sessions: [] });
    await assert.rejects(fixture.host.handleAsync("terminal.close", { sessionId }, APP), SessionNotFoundException);
  });

  it("answers two views' acknowledgements and detaches as done once their terminal is gone, and refuses its input and sizes as not found", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionId: string = await fixture.openAsync();
    for (const paneId of ["p1", "p2"])
      await fixture.host.handleAsync("terminal.attach", { sessionId, paneId }, APP);
    await fixture.host.handleAsync("terminal.close", { sessionId }, APP);

    for (const paneId of ["p1", "p2"]) {
      assert.equal(await fixture.host.handleAsync("terminal.ack", { sessionId, paneId, offset: 0 }, APP), null);
      assert.equal(await fixture.host.handleAsync("terminal.detach", { sessionId, paneId }, APP), null);
    }
    const isRefusal: (error: unknown) => boolean = error => error instanceof SessionNotFoundException && error instanceof MethodFailureException
      && error.failure.code === FailureCode.NotFound && error.failure.message === error.message;
    await assert.rejects(fixture.host.handleAsync("terminal.resize", { sessionId, size: SIZE }, APP), isRefusal);
    await assert.rejects(fixture.host.handleAsync("terminal.input", { sessionId, data: "x" }, APP), isRefusal);
  });

  it("closes an owner's terminals, ended ones too, by ending their shells and forgetting them, and says so for each, leaving the rest", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const first: string = await fixture.openAsync(ownedOpen("example.chat/42"));
    const firstProcess: FakePtyProcess = fixture.process;
    const general: string = await fixture.openAsync();
    const other: string = await fixture.openAsync(ownedOpen("example.chat/7"));
    const ended: string = await fixture.openAsync(ownedOpen("example.chat/42"));
    fixture.process.exit(0);

    assert.equal(await fixture.host.handleAsync("terminal.closeOwner", { owner: "example.chat/42" }, APP), null);

    assert.equal(firstProcess.ends, 1);
    assert.deepEqual(fixture.closed.published, [{ sessionId: first }, { sessionId: ended }]);
    assert.deepEqual((await fixture.listAsync()).map(t => t.sessionId), [general, other]);
    assert.deepEqual(fixture.saved.list().map(t => t.sessionId), [general, other]);
    assert.equal(await fixture.host.handleAsync("terminal.closeOwner", { owner: "example.chat/42" }, APP), null);
    assert.equal(fixture.closed.published.length, 2);
    await assert.rejects(fixture.host.handleAsync("terminal.closeOwner", { owner: "" }, APP),
      (error: unknown) => error instanceof JsonException && error.path === "$.owner");
  });

  it("closes an owner's terminal whose open is under way once its shell has started", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const started: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    fixture.spawner.hold = started.promise;

    const opening: Promise<string> = fixture.openAsync(ownedOpen("example.chat/42"));
    await fixture.spawner.held.promise;
    const closing: Promise<JsonValue> = fixture.host.handleAsync("terminal.closeOwner", { owner: "example.chat/42" }, APP);
    started.resolve();
    const sessionId: string = await opening;
    await closing;

    assert.deepEqual(fixture.closed.published, [{ sessionId }]);
    assert.equal(fixture.process.ends, 1);
    assert.deepEqual(await fixture.listAsync(), []);
    assert.deepEqual(fixture.saved.list(), []);
  });

  it("gives an agent's terminal the owner its session is bound to, keeps it for no next run, and closes it with that owner", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    fixture.host.bindAgentSession("agent-1", "example.chat/42");
    fixture.host.bindAgentSession("agent-2", "example.chat/7");
    fixture.host.bindAgentSession("agent-2", "example.chat/42");
    fixture.host.unbindAgentSession("agent-3");
    const owner: string | null = fixture.host.findAgentSessionOwner("agent-1");

    const sessionId: string = (await fixture.host.openTerminalAsync(null, "/work", new TerminalSize(80, 24), "agent-1", 104_857_600, null, false,
      owner)).session.sessionId;

    assert.deepEqual([owner, fixture.host.findAgentSessionOwner("agent-2"), fixture.host.findAgentSessionOwner("agent-3")],
      ["example.chat/42", "example.chat/42", null]);
    assert.deepEqual(await fixture.host.handleAsync("terminal.sessions", null, APP), {
      sessions: [{ sessionId, shellId: "bash", folder: "/work", title: "", exit: null, isAgentTerminal: true, isPanelTerminal: false,
        owner: "example.chat/42", opensTab: true, name: null, shellName: "bash", shellKind: "Bash" }]
    });
    assert.deepEqual(fixture.saved.list(), []);
    fixture.host.unbindAgentSession("agent-1");
    assert.equal(fixture.host.findAgentSessionOwner("agent-1"), null);
    await fixture.host.closeOwnerAsync("example.chat/42", null);
    assert.deepEqual(fixture.closed.published, [{ sessionId }]);
    assert.equal(fixture.process.ends, 1);
  });

  it("closes an owner's agent terminal whose open is under way once its shell has started", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const started: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    fixture.spawner.hold = started.promise;

    const opening: Promise<string> = fixture.host.openTerminalAsync(null, "/work", new TerminalSize(80, 24), "agent-1", 104_857_600, null, false,
      "example.chat/42").then(t => t.session.sessionId);
    await fixture.spawner.held.promise;
    const closing: Promise<void> = fixture.host.closeOwnerAsync("example.chat/42", null);
    started.resolve();
    const sessionId: string = await opening;
    await closing;

    assert.deepEqual(fixture.closed.published, [{ sessionId }]);
    assert.deepEqual(await fixture.listAsync(), []);
  });

  it("tells the windows of an agent's terminal that opens with an owner, and of every terminal with an owner that closes, but of no other", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const size: TerminalSize = new TerminalSize(80, 24);
    const owned: string = (await fixture.host.openTerminalAsync(null, "/work", size, "agent-1", 104_857_600, null, false, "example.chat/42")).session.sessionId;
    const unowned: string = (await fixture.host.openTerminalAsync(null, "/work", size, "agent-2")).session.sessionId;
    const persons: string = await fixture.openAsync(ownedOpen("example.chat/42"));
    const general: string = await fixture.openAsync();

    for (const sessionId of [unowned, general, owned])
      await fixture.host.closeTerminalAsync(sessionId);
    await fixture.host.handleAsync("terminal.close", { sessionId: persons }, APP);

    assert.deepEqual(fixture.opened.published, [
      { sessionId: owned, shellId: "bash", folder: "/work", title: "", exit: null, isAgentTerminal: true, isPanelTerminal: false, owner: "example.chat/42", opensTab: true, name: null, shellName: "bash", shellKind: "Bash" }
    ]);
    assert.deepEqual(fixture.closed.published, [{ sessionId: owned }, { sessionId: persons }]);
  });

  it("unbinds the agent sessions of an owner as its close starts, so their next terminals have no owner, and leaves other owners' bound", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    fixture.host.bindAgentSession("agent-1", "example.chat/42");
    fixture.host.bindAgentSession("agent-2", "example.chat/7");

    const closing: Promise<void> = fixture.host.closeOwnerAsync("example.chat/42", null);
    const owners: (string | null)[] = [fixture.host.findAgentSessionOwner("agent-1"), fixture.host.findAgentSessionOwner("agent-2")];
    await closing;

    assert.deepEqual(owners, [null, "example.chat/7"]);
  });

  it("forgets an owner's kept terminals that no window opened again, and closes the ones a restore under way brings back", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    fixture.saved.save(new SavedTerminal("kept", "bash", "/work", false, "example.chat/42"));
    fixture.saved.save(new SavedTerminal("general", "bash", "/work", false));
    const later: HostFixture = await HostFixture.createAsync();
    later.saved.save(new SavedTerminal("restoring", "bash", "/work", false, "example.chat/42"));

    await fixture.host.handleAsync("terminal.closeOwner", { owner: "example.chat/42" }, APP);
    const restore: Promise<JsonValue> = later.host.handleAsync("terminal.restore", RESTORE, APP);
    await later.host.handleAsync("terminal.closeOwner", { owner: "example.chat/42" }, APP);
    await restore;

    assert.deepEqual(fixture.saved.list().map(t => t.sessionId), ["general"]);
    assert.deepEqual(fixture.spawner.calls, []);
    assert.deepEqual(later.closed.published, [{ sessionId: "restoring" }]);
    assert.deepEqual(await later.listAsync(), []);
    assert.deepEqual(later.saved.list(), []);
  });

  it("restarts an ended terminal in place: the same shell and folder at the asking pane's size, from the environment as it reads now", async () => {
    const reads: Readonly<Record<string, string | undefined>>[] = [{ SHELL: "/bin/bash", GREETING: "first" }, { SHELL: "/bin/bash", GREETING: "second" }];
    const source: IEnvironmentSource = { start: () => undefined, readAsync: () => Promise.resolve(reads.shift() ?? {}), end: () => undefined };
    const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash" }, source);
    const sessionId: string = await fixture.openAsync();
    await fixture.host.handleAsync("terminal.resize", { sessionId, size: { cols: 100, rows: 30 } }, APP);
    fixture.process.exit(2);

    assert.equal(await fixture.host.handleAsync("terminal.restart", { sessionId, size: { cols: 120, rows: 40 } }, APP), null);

    assert.equal(fixture.spawner.calls[1], "/bin/bash [--init-file /tmp/noldova-terminal-1/noldova.bash -i] in /work at 120x40");
    assert.equal(fixture.spawner.environments[1]?.["GREETING"], "second");
    assert.notEqual(fixture.writer.nonceFor(fixture.spawner.environments[1]), fixture.writer.nonceFor(fixture.spawner.environments[0]));
    assert.deepEqual(fixture.restarted.published, [{ sessionId }]);
    assert.deepEqual(TerminalSessions.fromJson(await fixture.host.handleAsync("terminal.sessions", null, APP)).sessions.map(t => [t.sessionId, t.exit]), [[sessionId, null]]);
    fixture.process.emitData("again");
    await vi.waitFor(() => assert.match(fixture.outputData().join(""), /\u001b\[Hagain$/u));
    await fixture.endAllAsync();
  });

  it("ends a running shell before it starts the new one, and sends no end for it, since the terminal goes on", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionId: string = await fixture.openAsync();
    const first: FakePtyProcess = fixture.process;
    fixture.spawner.hold = Promise.resolve();

    const restarting: Promise<JsonValue> = fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP);
    await fixture.spawner.held.promise;

    assert.deepEqual([first.ends, fixture.spawner.spawned.length], [1, 1]);
    await restarting;
    assert.equal(fixture.spawner.spawned.length, 2);
    assert.deepEqual([fixture.exited.published, fixture.restarted.published], [[], [{ sessionId }]]);
    await fixture.endAllAsync();
  });

  it("logs a running shell a restart could not end, starts the new one anyway, and ignores the old one's late exit", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionId: string = await fixture.openAsync();
    const first: FakePtyProcess = fixture.process;
    first.isEndable = false;

    assert.equal(await fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP), null);

    assert.deepEqual(fixture.log.messages, [`The shell of terminal ${sessionId}, process 1000, or a process it started, did not end in time.`]);
    assert.deepEqual([first.ends, fixture.spawner.spawned.length], [1, 2]);
    assert.deepEqual(fixture.restarted.published, [{ sessionId }]);
    first.exit(0);
    assert.deepEqual(fixture.exited.published, []);
    await fixture.endAllAsync();
  });

  it("runs a restart asked while one is under way once that one ends, ending the shell it started", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionId: string = await fixture.openAsync();
    fixture.process.exit(0);
    const release: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    fixture.spawner.hold = release.promise;

    const first: Promise<JsonValue> = fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP);
    await fixture.spawner.held.promise;
    const second: Promise<JsonValue> = fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP);
    assert.deepEqual([fixture.spawner.spawned.length, fixture.spawner.holding, fixture.restarted.published.length], [1, 1, 0]);
    fixture.spawner.hold = null;
    release.resolve();

    assert.deepEqual(await Promise.all([first, second]), [null, null]);
    assert.equal(fixture.spawner.spawned.length, 3);
    assert.deepEqual(fixture.spawner.spawned.map(t => t.ends), [1, 1, 0]);
    assert.deepEqual(fixture.restarted.published, [{ sessionId }, { sessionId }]);
    await fixture.endAllAsync();
  });

  it("refuses to restart an agent's terminal, and a session it does not have", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionId: string = (await fixture.host.openTerminalAsync(null, "/work", new TerminalSize(80, 24), "agent-1", 104_857_600, null, false,
      "example.chat/42")).session.sessionId;
    fixture.process.exit(0);

    await assert.rejects(fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP), AgentTerminalRestartException);
    await assert.rejects(fixture.host.handleAsync("terminal.restart", { sessionId: "s9", size: SIZE }, APP), SessionNotFoundException);

    assert.equal(fixture.spawner.spawned.length, 1);
  });

  for (const isEndable of [true, false]) {
    it(`ends the new shell of a restart whose terminal closed meanwhile${isEndable ? "" : ", and logs one that stays"}`, async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const sessionId: string = await fixture.openAsync();
      fixture.process.exit(0);
      const release: PromiseWithResolvers<void> = Promise.withResolvers<void>();
      fixture.spawner.hold = release.promise;
      fixture.spawner.isEndable = isEndable;

      const restarting: Promise<JsonValue> = fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP);
      await fixture.spawner.held.promise;
      await fixture.host.handleAsync("terminal.close", { sessionId }, APP);
      release.resolve();

      await assert.rejects(restarting, SessionNotFoundException);
      assert.equal(fixture.process.ends, 1);
      assert.deepEqual(fixture.log.messages, isEndable ? [] : ["A shell that started as the terminals ended, process 1001, or a process it started, did not end in time."]);
      assert.deepEqual(fixture.restarted.published, []);
    });
  }

  it("starts no shell for a restart that waited while its terminal closed", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionId: string = await fixture.openAsync();
    fixture.process.exit(0);
    const release: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    fixture.spawner.hold = release.promise;

    const first: Promise<JsonValue> = fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP);
    await fixture.spawner.held.promise;
    const second: Promise<JsonValue> = fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP);
    await fixture.host.handleAsync("terminal.close", { sessionId }, APP);
    fixture.spawner.hold = null;
    release.resolve();

    await assert.rejects(first, SessionNotFoundException);
    await assert.rejects(second, SessionNotFoundException);
    assert.equal(fixture.spawner.spawned.length, 2);
  });

  it("keeps a terminal whose running shell a restart ends while it already keeps the most ended terminals", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionId: string = await fixture.openAsync();
    for (let i = 0; i < 32; i++) {
      await fixture.openAsync();
      fixture.process.exit(0);
    }

    assert.equal(await fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP), null);

    const sessions: readonly TerminalSummary[] = TerminalSessions.fromJson(await fixture.host.handleAsync("terminal.sessions", null, APP)).sessions;
    assert.deepEqual([sessions.length, sessions[0]?.sessionId, sessions[0]?.exit], [33, sessionId, null]);
    assert.deepEqual(fixture.restarted.published, [{ sessionId }]);
    await fixture.endAllAsync();
  });

  it("passes on a restart whose shell can't start, having ended the old one, and forgets the terminal in its turn", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionId: string = await fixture.openAsync();
    const first: FakePtyProcess = fixture.process;
    for (let i = 0; i < 32; i++)
      await fixture.openAsync();
    const failure: Error = new Error("no pseudo-terminal");
    fixture.spawner.failure = failure;

    await assert.rejects(fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP), (t: unknown) => t === failure);
    const ended: JsonValue[] = fixture.exited.published.splice(0);
    for (const process of fixture.spawner.spawned.slice(1))
      process.exit(0);

    const sessions: readonly TerminalSummary[] = TerminalSessions.fromJson(await fixture.host.handleAsync("terminal.sessions", null, APP)).sessions;
    assert.deepEqual([first.ends, fixture.restarted.published.length], [1, 0]);
    assert.deepEqual(ended, [{ sessionId, exit: { exitCode: null, endedBy: "Close" } }]);
    assert.deepEqual([sessions.length, sessions.some(t => t.sessionId === sessionId)], [32, false]);
  });

  it("logs a shell that does not end", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionId: string = await fixture.openAsync();
    fixture.process.isEndable = false;

    await fixture.host.handleAsync("terminal.close", { sessionId }, APP);

    assert.deepEqual(fixture.log.messages, [`The shell of terminal ${sessionId}, process 1000, or a process it started, did not end in time.`]);
  });

  it("keeps only the latest 32 ended terminals", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    const sessionIds: string[] = [];
    for (let index: number = 0; index < 33; index++) {
      sessionIds.push(await fixture.openAsync());
      fixture.process.exit(0);
    }
    const running: string = await fixture.openAsync();

    const listed: readonly string[] = TerminalSessions.fromJson(await fixture.host.handleAsync("terminal.sessions", null, APP)).sessions.map(t => t.sessionId);

    assert.deepEqual(listed, [...sessionIds.slice(1), running]);
  });

  it("logs an ended terminal it forgets but could not put away", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    vi.spyOn(TerminalSession.prototype, "disposeAsync").mockRejectedValueOnce(new Error("busy"));
    const oldest: string = await fixture.openAsync();
    fixture.process.exit(0);
    for (let index: number = 0; index < 32; index++) {
      await fixture.openAsync();
      fixture.process.exit(0);
    }

    await vi.waitFor(() => assert.deepEqual(fixture.log.messages, [`The ended terminal ${oldest} could not be put away: busy`]));
    await fixture.endAllAsync();
  });

  it("refuses to open a default shell when it finds none", async () => {
    const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", {});

    await assert.rejects(fixture.host.openTerminalAsync(null, "/work", new TerminalSize(80, 24), null),
      (error: unknown) => error instanceof DefaultShellNotFoundException && error.message === "No default shell was found.");
  });

  it("ends every session", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();
    await fixture.openAsync();
    await fixture.openAsync();

    await fixture.endAllAsync();

    assert.deepEqual(fixture.spawner.spawned.map(t => t.ends), [1, 1]);
    assert.deepEqual(fixture.writer.removed, [path.join("/tmp", "noldova-terminal-1")]);
    assert.deepEqual(fixture.historyWriter.removed, [path.join("/tmp", "noldova-terminal-lines-400-1")]);
    assert.deepEqual(await fixture.host.handleAsync("terminal.sessions", null, APP), { sessions: [] });
  });

  it("refuses to store less than 10 MiB or more than 10,000 MiB", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();

    for (const storedLimit of [10_485_759, 10_485_760_001])
      await assert.rejects(fixture.openAsync({ shellId: "bash", folder: "/work", size: { cols: 80, rows: 24 }, storedLimit }), { path: "$.storedLimit" });
    assert.equal(fixture.spawner.spawned.length, 0);
  });

  describe("with connections", () => {
    const size: TerminalSize = new TerminalSize(80, 24);
    const panelOpen: JsonValue = { shellId: null, folder: "/work", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, isPanelTerminal: true };

    function openOwnedAgentAsync(fixture: HostFixture): Promise<string> {
      return fixture.host.openTerminalAsync(null, "/work", size, "agent-1", 104_857_600, null, false, "example.chat/42").then(t => t.session.sessionId);
    }

    async function openFromAsync(fixture: HostFixture, client: RequestClient, open: JsonValue = OPEN): Promise<string> {
      return TerminalReference.fromJson(await fixture.host.handleAsync("terminal.open", open, client)).sessionId;
    }

    async function listFromAsync(fixture: HostFixture, client: RequestClient): Promise<readonly string[]> {
      return TerminalSessions.fromJson(await fixture.host.handleAsync("terminal.sessions", null, client)).sessions.map(t => t.sessionId);
    }

    it("refuses to complete a line of a terminal another connection opened, in either direction, reading nothing for it", async () => {
      const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash", PATH: "/usr/bin" });
      const persons: string = await fixture.openAsync();
      const commandLines: string = await openFromAsync(fixture, COMMAND_LINE);
      const listed: readonly string[] = [...fixture.fileSystem.listed];

      await assert.rejects(fixture.host.handleAsync("terminal.complete", { sessionId: persons, line: "cat ", cursor: 4 }, COMMAND_LINE), SessionNotFoundException);
      await assert.rejects(fixture.host.handleAsync("terminal.complete", { sessionId: commandLines, line: "cat ", cursor: 4 }, APP), SessionNotFoundException);
      assert.deepEqual(fixture.fileSystem.listed, listed);
    });

    it("lets the window type into an agent's terminal with an owner, and answers the command line about it as not found", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const owned: string = await openOwnedAgentAsync(fixture);

      await fixture.host.handleAsync("terminal.input", { sessionId: owned, data: "y" }, APP);

      assert.deepEqual(fixture.process.writes, ["y"]);
      await assert.rejects(fixture.host.handleAsync("terminal.input", { sessionId: owned, data: "n" }, COMMAND_LINE), SessionNotFoundException);
      assert.deepEqual(await listFromAsync(fixture, COMMAND_LINE), []);
      assert.deepEqual(fixture.process.writes, ["y"]);
    });

    it("answers a connection about the terminals it opened, the app's also about the agents' with an owner, and any other as not found", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const persons: string = await fixture.openAsync();
      const owned: string = await openOwnedAgentAsync(fixture);
      const unowned: string = (await fixture.host.openTerminalAsync(null, "/work", size, "agent-2")).session.sessionId;
      const commandLines: string = await openFromAsync(fixture, COMMAND_LINE);

      assert.deepEqual(await fixture.listAsync().then(t => t.map(u => u.sessionId)), [persons, owned]);
      assert.deepEqual(await listFromAsync(fixture, COMMAND_LINE), [commandLines]);
      for (const sessionId of [persons, owned, unowned])
        await assert.rejects(fixture.host.handleAsync("terminal.close", { sessionId }, COMMAND_LINE), SessionNotFoundException);
      for (const sessionId of [commandLines, unowned])
        await assert.rejects(fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP), SessionNotFoundException);
      assert.deepEqual(fixture.saved.list().map(t => t.sessionId), [persons]);
      assert.equal(fixture.spawner.spawned.filter(t => t.ends > 0).length, 0);
    });

    it("sends a terminal's events to each window of the connections that reach it, and none of the app's terminals' to the command line", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      await fixture.host.handleAsync("terminal.sessions", null, new RequestClient(1, 2, true));
      await fixture.host.handleAsync("terminal.sessions", null, COMMAND_LINE);
      const persons: string = await fixture.openAsync();
      const personsProcess: FakePtyProcess = fixture.process;
      const owned: string = await openOwnedAgentAsync(fixture);
      const ownedProcess: FakePtyProcess = fixture.process;
      const commandLines: string = await openFromAsync(fixture, COMMAND_LINE);
      const commandLinesProcess: FakePtyProcess = fixture.process;

      personsProcess.emitData("a");
      ownedProcess.emitData("b");
      commandLinesProcess.emitData("c");

      await vi.waitFor(() => assert.equal(fixture.output.published.length, 5));
      assert.deepEqual(fixture.output.published.map((t, i) => `${TerminalOutput.fromJson(t).sessionId} ${fixture.output.targets[i]}`).sort(),
        [`${persons} 1/1`, `${persons} 1/2`, `${owned} 1/1`, `${owned} 1/2`, `${commandLines} 2/null`].sort());
      assert.deepEqual(fixture.opened.targets, ["1/1", "1/2"]);
    });

    it("stops sending events to a window closed for good, ending nothing, and keeps sending them to a window that reloads", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      await fixture.host.handleAsync("terminal.sessions", null, new RequestClient(1, 2, true));
      const sessionId: string = await fixture.openAsync();

      await fixture.host.closeConnectionAsync(1, 2);
      await fixture.host.handleAsync("terminal.sessions", null, APP);
      fixture.process.emitData("a");

      await vi.waitFor(() => assert.equal(fixture.output.published.length, 1));
      assert.deepEqual([fixture.output.published.map(t => TerminalOutput.fromJson(t).sessionId), fixture.output.targets], [[sessionId], ["1/1"]]);
      assert.equal(fixture.process.ends, 0);
    });

    it("ends a closed connection's terminals, keeps the person's for the next app connection, which restores them, and ends the agents' with an owner with the app's", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const persons: string = await fixture.openAsync();
      const personsProcess: FakePtyProcess = fixture.process;
      await openOwnedAgentAsync(fixture);
      const ownedProcess: FakePtyProcess = fixture.process;
      const unowned: string = (await fixture.host.openTerminalAsync(null, "/work", size, "agent-2")).session.sessionId;
      const unownedProcess: FakePtyProcess = fixture.process;
      await openFromAsync(fixture, COMMAND_LINE);
      const commandLinesProcess: FakePtyProcess = fixture.process;
      const processes: readonly FakePtyProcess[] = [personsProcess, ownedProcess, unownedProcess, commandLinesProcess];
      await fixture.host.handleAsync("terminal.restore", RESTORE, APP);
      const next: RequestClient = new RequestClient(3, 1, true);

      await fixture.host.closeConnectionAsync(2, null);
      const afterCommandLine: readonly number[] = processes.map(t => t.ends);
      await fixture.host.closeConnectionAsync(1, null);
      const afterApp: readonly number[] = processes.map(t => t.ends);
      await fixture.host.handleAsync("terminal.restore", RESTORE, next);

      assert.deepEqual([afterCommandLine, afterApp], [[0, 0, 0, 1], [1, 1, 0, 1]]);
      assert.deepEqual(await listFromAsync(fixture, next), [persons]);
      assert.deepEqual(fixture.saved.list().map(t => t.sessionId), [persons]);
      assert.equal(fixture.host.findTerminal(unowned)?.session.hasExited, false);
      assert.deepEqual(fixture.exited.published, []);
    });

    it("ends a terminal whose open was under way as its connection closed, once its shell has started", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const started: PromiseWithResolvers<void> = Promise.withResolvers<void>();
      fixture.spawner.hold = started.promise;

      const opening: Promise<string> = fixture.openAsync();
      await fixture.spawner.held.promise;
      const closing: Promise<void> = fixture.host.closeConnectionAsync(1, null);
      started.resolve();
      await opening;
      await closing;

      assert.equal(fixture.process.ends, 1);
      assert.deepEqual(await fixture.listAsync(), []);
    });

    it("restores the person's terminals for a reconnected app whose restore came while the old connection's close waited on an open", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      await fixture.host.handleAsync("terminal.restore", RESTORE, APP);
      const persons: string = await fixture.openAsync();
      const started: PromiseWithResolvers<void> = Promise.withResolvers<void>();
      fixture.spawner.hold = started.promise;
      const next: RequestClient = new RequestClient(3, 1, true);

      const opening: Promise<string> = fixture.openAsync();
      await fixture.spawner.held.promise;
      const closing: Promise<void> = fixture.host.closeConnectionAsync(1, null);
      const restoring: Promise<JsonValue> = fixture.host.handleAsync("terminal.restore", RESTORE, next);
      started.resolve();
      const opened: string = await opening;
      await closing;
      await restoring;

      assert.deepEqual([...await listFromAsync(fixture, next)].sort(), [persons, opened].sort());
      assert.deepEqual(fixture.saved.list().map(t => t.sessionId).sort(), [persons, opened].sort());
    });

    it("restores nothing for a reconnected app whose connection closed while its restore waited on the old connection's close, and leaves the person's terminals to the next app connection", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      await fixture.host.handleAsync("terminal.restore", RESTORE, APP);
      const persons: string = await fixture.openAsync();
      const started: PromiseWithResolvers<void> = Promise.withResolvers<void>();
      fixture.spawner.hold = started.promise;
      const gone: RequestClient = new RequestClient(3, 1, true);
      const last: RequestClient = new RequestClient(5, 1, true);

      const opening: Promise<string> = fixture.openAsync();
      await fixture.spawner.held.promise;
      const closing: Promise<void> = fixture.host.closeConnectionAsync(1, null);
      const restoring: Promise<JsonValue> = fixture.host.handleAsync("terminal.restore", RESTORE, gone);
      const goneClosing: Promise<void> = fixture.host.closeConnectionAsync(3, null);
      started.resolve();
      const opened: string = await opening;
      await closing;
      await restoring;
      await goneClosing;
      const spawnsBefore: number = fixture.spawner.calls.length;
      await fixture.host.handleAsync("terminal.restore", RESTORE, last);

      assert.equal(fixture.spawner.calls.length - spawnsBefore, 2);
      assert.deepEqual([...await listFromAsync(fixture, last)].sort(), [persons, opened].sort());
    });

    for (const [kind, open] of [["tab", OPEN], ["panel", panelOpen]] as const) {
      it(`ends a ${kind} terminal whose connection closed while its open checked the folder, and keeps it for the next app connection to restore`, async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const checked: PromiseWithResolvers<void> = Promise.withResolvers<void>();
        fixture.fileSystem.hold = checked.promise;
        const next: RequestClient = new RequestClient(3, 1, true);

        const opening: Promise<string> = fixture.openAsync(open);
        await fixture.fileSystem.held.promise;
        const closing: Promise<void> = fixture.host.closeConnectionAsync(1, null);
        checked.resolve();
        const sessionId: string = await opening;
        await closing;
        const ends: number = fixture.process.ends;
        await fixture.host.handleAsync("terminal.restore", RESTORE, next);

        assert.equal(ends, 1);
        assert.deepEqual(await listFromAsync(fixture, next), [sessionId]);
      });
    }

    it("ends nothing more when a connection closes after the host ended", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      await fixture.openAsync();
      await fixture.endAllAsync();
      const ends: number = fixture.process.ends;

      await fixture.host.closeConnectionAsync(1, null);

      assert.equal(fixture.process.ends, ends);
    });

    it("restores nothing for a connection other than the app's, and keeps none of its terminals", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      fixture.saved.save(new SavedTerminal("kept", "bash", "/work", false));

      await fixture.host.handleAsync("terminal.restore", RESTORE, COMMAND_LINE);
      await openFromAsync(fixture, COMMAND_LINE);
      fixture.reportCwd(fixture.process, "/work/src");

      assert.equal(fixture.spawner.spawned.length, 1);
      assert.deepEqual(fixture.saved.list(), [new SavedTerminal("kept", "bash", "/work", false)]);
    });

    it("gives each connection its own panel terminal", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();

      const apps: string = await fixture.openAsync(panelOpen);
      const commandLines: Promise<string>[] = [openFromAsync(fixture, COMMAND_LINE, panelOpen), openFromAsync(fixture, COMMAND_LINE, panelOpen)];
      const [first, second]: string[] = await Promise.all(commandLines);

      assert.notEqual(first, apps);
      assert.equal(second, first);
      assert.equal(await fixture.openAsync(panelOpen), apps);
      assert.equal(fixture.spawner.spawned.length, 2);
    });

    it("closes by a client's request only the owner's terminals its connection reaches, and only the app's forgets the kept ones and unbinds", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      fixture.host.bindAgentSession("agent-1", "example.chat/42");
      const persons: string = await fixture.openAsync(ownedOpen("example.chat/42"));
      const commandLines: string = await openFromAsync(fixture, COMMAND_LINE, ownedOpen("example.chat/42"));

      await fixture.host.handleAsync("terminal.closeOwner", { owner: "example.chat/42" }, COMMAND_LINE);
      const afterCommandLine: unknown[] = [(await fixture.listAsync()).map(t => t.sessionId), fixture.saved.list().map(t => t.sessionId),
        fixture.host.findAgentSessionOwner("agent-1")];
      await fixture.host.handleAsync("terminal.closeOwner", { owner: "example.chat/42" }, APP);

      assert.deepEqual(afterCommandLine, [[persons], [persons], "example.chat/42"]);
      assert.deepEqual([await fixture.listAsync(), fixture.saved.list(), fixture.host.findAgentSessionOwner("agent-1")], [[], [], null]);
      assert.deepEqual([fixture.closed.published, fixture.closed.targets], [[{ sessionId: commandLines }, { sessionId: persons }], ["2/null", "1/1"]]);
    });
  });

  describe("with stored lines", () => {
    let temporaryFolder: string = "";

    beforeEach(async () => {
      temporaryFolder = await mkdtemp(path.join(tmpdir(), "terminal-host-"));
    });

    afterEach(async () => {
      await rm(temporaryFolder, { recursive: true, force: true });
    });

    function createStoringAsync(): Promise<HostFixture> {
      const log: FakeModuleLog = new FakeModuleLog();
      return HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash" }, new InheritedEnvironment({ SHELL: "/bin/bash" }),
        new TerminalHistoryFolder(new FileSystemWriter(), new FileSystemReader(), new ProcessSignaller(), temporaryFolder, process.pid, log));
    }

    async function storedFolderAsync(): Promise<string> {
      const names: string[] = (await readdir(temporaryFolder)).filter(t => t.startsWith("noldova-terminal-lines-"));
      assert.equal(names.length, 1);
      return path.join(temporaryFolder, names[0] ?? "");
    }

    it("pages a terminal's stored lines, removes them when it closes, and removes their folder when it ends", async () => {
      const fixture: HostFixture = await createStoringAsync();
      const sessionId: string = await fixture.openAsync();
      fixture.process.emitData(Array.from({ length: 1_100 }, (_t, index) => `line ${index}\r\n`).join(""));
      await fixture.host.handleAsync("terminal.attach", { sessionId, paneId: "p1" }, APP);

      const page: TerminalLinePage = TerminalLinePage.fromJson(await fixture.host.handleAsync("terminal.lines", { sessionId, start: 70, limit: 10 }, APP));
      const folder: string = await storedFolderAsync();
      const files: string[] = await readdir(folder);
      await fixture.host.handleAsync("terminal.close", { sessionId }, APP);
      const closed: string[] = await readdir(folder);
      await fixture.endAllAsync();

      assert.deepEqual([page.start, page.lines.map(t => t.text), page.stored.toJson()], [70, ["line 70", "line 71", "line 72", "line 73", "line 74",
        "line 75", "line 76"], { start: 0, end: 77, dropped: 0 }]);
      assert.deepEqual([files, closed], [[`${sessionId}-1.jsonl`], []]);
      assert.deepEqual((await readdir(temporaryFolder)).filter(t => t.startsWith("noldova-terminal-lines-")), []);
    });

    it("opens a terminal without stored lines when their folder can't be made private, and logs why", async () => {
      const log: FakeModuleLog = new FakeModuleLog();
      const access: FakeFolderAccess = new FakeFolderAccess(new FakeFileSystemWriter());
      access.failure = new Error("icacls.exe exited with 5.");
      const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash" }, undefined,
        new TerminalHistoryFolder(new FileSystemWriter(), new FileSystemReader(), new ProcessSignaller(), temporaryFolder, process.pid, log, access));

      const sessionId: string = await fixture.openAsync();
      fixture.process.emitData(Array.from({ length: 1_100 }, (_t, index) => `line ${index}\r\n`).join(""));
      await fixture.host.handleAsync("terminal.attach", { sessionId, paneId: "p1" }, APP);

      await assert.rejects(fixture.host.handleAsync("terminal.lines", { sessionId, start: 0, limit: 10 }, APP),
        { message: "The terminal's stored lines could not be written." });
      assert.deepEqual(await readdir(temporaryFolder), []);
      assert.deepEqual(log.messages, ["A terminal opens without stored lines, whose folder could not be made private: icacls.exe exited with 5."]);
      await fixture.endAllAsync();
    });

    it("keeps storing an owned terminal's output while its owner is hidden, as for a shown one, and pages it once the owner shows again", async () => {
      const fixture: HostFixture = await createStoringAsync();
      const shown: string = await fixture.openAsync(ownedOpen("example.chat/42"));
      const shownProcess: FakePtyProcess = fixture.process;
      const hidden: string = await fixture.openAsync(ownedOpen("example.chat/7"));
      const hiddenProcess: FakePtyProcess = fixture.process;
      await fixture.host.handleAsync("terminal.attach", { sessionId: shown, paneId: "p1" }, APP);
      await fixture.host.handleAsync("terminal.attach", { sessionId: hidden, paneId: "p2" }, APP);
      await fixture.host.handleAsync("terminal.detach", { sessionId: hidden, paneId: "p2" }, APP);

      const output: string = Array.from({ length: 1_100 }, (_t, index) => `line ${index}\r\n`).join("");
      shownProcess.emitData(output);
      hiddenProcess.emitData(output);
      const shownAgain: TerminalAttachment = TerminalAttachment.fromJson(await fixture.host.handleAsync("terminal.attach", { sessionId: hidden, paneId: "p3" }, APP));
      const stillShown: TerminalAttachment = TerminalAttachment.fromJson(await fixture.host.handleAsync("terminal.attach", { sessionId: shown, paneId: "p4" }, APP));
      const page: TerminalLinePage = TerminalLinePage.fromJson(await fixture.host.handleAsync("terminal.lines", { sessionId: hidden, start: 0, limit: 2 }, APP));
      await fixture.endAllAsync();

      assert.ok(shownAgain.stored.end > 0 && shownAgain.stored.dropped === 0, JSON.stringify(shownAgain.stored.toJson()));
      assert.deepEqual(shownAgain.stored.toJson(), stillShown.stored.toJson());
      assert.match(shownAgain.snapshot, /line 1099/u);
      assert.deepEqual(page.lines.map(t => t.text), ["line 0", "line 1"]);
    });

    it("logs a terminal whose stored lines can't be removed, and still removes their folder when it ends", async () => {
      const fixture: HostFixture = await createStoringAsync();
      const sessionId: string = await fixture.openAsync();
      await mkdir(path.join(await storedFolderAsync(), `${sessionId}-1.jsonl`));

      await fixture.host.handleAsync("terminal.close", { sessionId }, APP);
      await fixture.endAllAsync();

      assert.equal(fixture.log.messages.length, 1);
      assert.ok(fixture.log.messages[0]?.startsWith(`The stored lines of terminal ${sessionId} could not be removed: `), JSON.stringify(fixture.log.messages));
      assert.deepEqual((await readdir(temporaryFolder)).filter(t => t.startsWith("noldova-terminal-lines-")), []);
    });

    it("refuses to page a session it does not have, or more than 500 lines", async () => {
      const fixture: HostFixture = await createStoringAsync();
      const sessionId: string = await fixture.openAsync();

      await assert.rejects(fixture.host.handleAsync("terminal.lines", { sessionId: "gone", start: 0, limit: 10 }, APP), SessionNotFoundException);
      await assert.rejects(fixture.host.handleAsync("terminal.lines", { sessionId, start: 0, limit: 501 }, APP), { path: "$.limit" });
      await fixture.endAllAsync();
    });
  });

  it("refuses a pane's folder that is absolute only on Windows, on Linux and macOS", async () => {
    const fixture: HostFixture = await HostFixture.createAsync();

    for (const folder of ["C:\\work", "\\\\server\\share"])
      await assert.rejects(fixture.openAsync({ shellId: "bash", folder, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 }), /The value must be an absolute path\. \(Parameter 'folder'\)/u);
    assert.deepEqual(fixture.spawner.calls, []);
  });

  describe("keeping the person's terminals for the next run", () => {
    const panelOpen: JsonValue = { shellId: "bash", folder: "/work", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, isPanelTerminal: true };

    it("keeps each of the person's terminals in the order they opened, with its shell, last folder, whether it is the panel's and its owner, but no agent's", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const tab: string = await fixture.openAsync();
      const tabProcess: FakePtyProcess = fixture.process;
      const panel: string = await fixture.openAsync(panelOpen);
      const owned: string = await fixture.openAsync(ownedOpen("example.chat/42"));
      const agent: string = (await fixture.host.openTerminalAsync("bash", "/work", new TerminalSize(80, 24), "agent-1")).session.sessionId;
      const agentProcess: FakePtyProcess = fixture.process;

      fixture.reportCwd(tabProcess, "/work/src");
      fixture.reportCwd(agentProcess, "/work/agent");

      assert.deepEqual(fixture.saved.list(), [
        new SavedTerminal(tab, "bash", "/work/src", false),
        new SavedTerminal(panel, "bash", "/work", true),
        new SavedTerminal(owned, "bash", "/work", false, "example.chat/42")
      ]);
      assert.deepEqual(fixture.cwdChanged.published, [{ sessionId: tab, cwd: "/work/src" }]);
      assert.equal(fixture.host.findTerminal(agent)?.session.commands.cwd, "/work/agent");
    });

    it("forgets a terminal the person closes and one it stops listing, and keeps the rest when it ends", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const closed: string = await fixture.openAsync();
      const ended: string[] = [];
      for (let index: number = 0; index < 33; index++) {
        ended.push(await fixture.openAsync());
        fixture.process.exit(0);
      }
      const running: string = await fixture.openAsync();

      await fixture.host.handleAsync("terminal.close", { sessionId: closed }, APP);
      await fixture.endAllAsync();

      assert.deepEqual(fixture.saved.list().map(t => t.sessionId), [...ended.slice(1), running]);
    });

    it("opens the terminals the last run left open again once, with their ids, shells and last folders, at the asking window's size", async () => {
      const last: HostFixture = await HostFixture.createAsync();
      last.fileSystem.folders.add("/work/src");
      const tab: string = await last.openAsync();
      last.reportCwd(last.process, "/work/src");
      const panel: string = await last.openAsync(panelOpen);
      const owned: string = await last.openAsync(ownedOpen("example.chat/42"));
      await last.endAllAsync();
      const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash" }, undefined, null, last.database);
      fixture.fileSystem.folders.add("/work/src");

      assert.equal(await fixture.host.handleAsync("terminal.restore", { size: { cols: 100, rows: 30 }, shellId: null, storedLimit: 104_857_600 }, APP), null);
      assert.equal(await fixture.host.handleAsync("terminal.restore", RESTORE, APP), null);

      assert.equal(fixture.spawner.calls.length, 3);
      assert.match(fixture.spawner.calls[0] ?? "", /^\/bin\/bash .* in \/work\/src at 100x30$/u);
      assert.match(fixture.spawner.calls[1] ?? "", /^\/bin\/bash .* in \/work at 100x30$/u);
      assert.deepEqual(fixture.spawner.inheritsCursor, [false, false, false]);
      assert.deepEqual(await fixture.listAsync(), [
        new TerminalSummary(tab, "bash", "/work/src", "", null, false, false, null, true, null, "bash", TerminalShellKind.Bash),
        new TerminalSummary(panel, "bash", "/work", "", null, false, true, null, true, null, "bash", TerminalShellKind.Bash),
        new TerminalSummary(owned, "bash", "/work", "", null, false, false, "example.chat/42", true, null, "bash", TerminalShellKind.Bash)
      ]);
      assert.deepEqual(fixture.log.messages, []);
      assert.deepEqual(fixture.saved.list(), [
        new SavedTerminal(tab, "bash", "/work/src", false),
        new SavedTerminal(panel, "bash", "/work", true),
        new SavedTerminal(owned, "bash", "/work", false, "example.chat/42")
      ]);
    });

    it("opens a renamed terminal again with its name, and one whose kept name is blank or too long with none, which it still lists", async () => {
      const last: HostFixture = await HostFixture.createAsync();
      const named: string = await last.openAsync();
      await last.host.handleAsync("terminal.rename", { sessionId: named, name: "Server" }, APP);
      const blank: string = await last.openAsync();
      last.saved.rename(blank, "  ");
      const long: string = await last.openAsync();
      last.saved.rename(long, "n".repeat(4097));
      await last.endAllAsync();
      const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash" }, undefined, null, last.database);

      await fixture.host.handleAsync("terminal.restore", RESTORE, APP);

      assert.deepEqual((await fixture.listAsync()).map(t => [t.sessionId, t.name]), [[named, "Server"], [blank, null], [long, null]]);
      assert.deepEqual(fixture.saved.list().map(t => t.name), ["Server", "  ", "n".repeat(4097)]);
    });

    it("opens a terminal whose folder or shell is gone with the home folder or the default shell, and says so in the log and on one line", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      fixture.fileSystem.folders.add("/home/a");
      fixture.saved.save(new SavedTerminal("s1", "bash", "/gone", false));
      fixture.saved.save(new SavedTerminal("s2", "zsh", "/work", false));
      fixture.saved.save(new SavedTerminal("s3", "zsh", "/gone", false));
      fixture.saved.save(new SavedTerminal("s4", "bash", "work", false));

      await fixture.host.handleAsync("terminal.restore", RESTORE, APP);

      assert.deepEqual(fixture.spawner.calls.map(t => t.replace(/^\/bin\/bash .* in /u, "")).sort(), ["/home/a at 80x24", "/home/a at 80x24", "/home/a at 80x24", "/work at 80x24"]);
      assert.deepEqual(fixture.spawner.inheritsCursor, [true, true, true, true]);
      assert.deepEqual([...fixture.log.messages].sort(), [
        "Terminal s1 opened in /home/a, since the folder /gone does not exist.",
        "Terminal s2 started the default shell, since the shell zsh is no longer available.",
        "Terminal s3 opened in /home/a, since the folder /gone does not exist.",
        "Terminal s3 started the default shell, since the shell zsh is no longer available.",
        "Terminal s4 opened in /home/a, since the folder work does not exist."
      ]);
      const notes: ReadonlyMap<string, string> = await fixture.notesAsync(4);
      assert.deepEqual([...notes].sort(([a], [b]) => a.localeCompare(b)), [
        ["s1", "\u001b[2;3mThe folder /gone does not exist, so this terminal opened in the home folder.\u001b[0m\r\n"],
        ["s2", "\u001b[2;3mThe shell zsh is no longer available, so this terminal started the default shell.\u001b[0m\r\n"],
        ["s3", "\u001b[2;3mThe shell zsh is no longer available and the folder /gone does not exist, so this terminal started the default shell in the home folder.\u001b[0m\r\n"],
        ["s4", "\u001b[2;3mThe folder work does not exist, so this terminal opened in the home folder.\u001b[0m\r\n"]
      ]);
      assert.deepEqual(fixture.saved.list(), [
        new SavedTerminal("s1", "bash", "/home/a", false),
        new SavedTerminal("s2", "bash", "/work", false),
        new SavedTerminal("s3", "bash", "/home/a", false),
        new SavedTerminal("s4", "bash", "/home/a", false)
      ]);
    });

    it("starts the window's default shell for a terminal whose shell is gone while the runtime finds it, else the runtime's, and stores what the window allows", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      fixture.fileSystem.files.set("/etc/shells", "/bin/zsh\n");
      fixture.fileSystem.files.set("/bin/zsh", "");
      fixture.saved.save(new SavedTerminal("s1", "fish", "/work", false));
      fixture.saved.save(new SavedTerminal("s2", "bash", "/work", false));
      const open = vi.spyOn(fixture.host, "openTerminalAsync");
      const other: HostFixture = await HostFixture.createAsync();
      other.saved.save(new SavedTerminal("s3", "fish", "/work", false));

      await fixture.host.handleAsync("terminal.restore", { size: SIZE, shellId: "zsh", storedLimit: 52_428_800 }, APP);
      await other.host.handleAsync("terminal.restore", { size: SIZE, shellId: "tcsh", storedLimit: 104_857_600 }, APP);

      assert.deepEqual(fixture.saved.list(), [new SavedTerminal("s1", "zsh", "/work", false), new SavedTerminal("s2", "bash", "/work", false)]);
      assert.deepEqual(open.mock.calls.map(t => t[4]), [52_428_800, 52_428_800]);
      assert.deepEqual(fixture.log.messages, ["Terminal s1 started the default shell, since the shell fish is no longer available."]);
      assert.deepEqual(other.saved.list(), [new SavedTerminal("s3", "bash", "/work", false)]);
    });

    it("opens only the latest panel terminal again, and forgets the others", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      fixture.saved.save(new SavedTerminal("p1", "bash", "/work", true));
      fixture.saved.save(new SavedTerminal("t1", "bash", "/work", false));
      fixture.saved.save(new SavedTerminal("p2", "bash", "/work", true));

      await fixture.host.handleAsync("terminal.restore", RESTORE, APP);

      assert.deepEqual((await fixture.listAsync()).map(t => [t.sessionId, t.isPanelTerminal]), [["t1", false], ["p2", true]]);
      assert.deepEqual(fixture.saved.list().map(t => t.sessionId), ["t1", "p2"]);
    });

    it("opens no saved panel terminal while this run has one, and forgets it", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const panel: string = await fixture.openAsync(panelOpen);
      fixture.saved.save(new SavedTerminal("p1", "bash", "/work", true));

      await fixture.host.handleAsync("terminal.restore", RESTORE, APP);

      assert.deepEqual((await fixture.listAsync()).map(t => t.sessionId), [panel]);
      assert.deepEqual(fixture.saved.list().map(t => t.sessionId), [panel]);
    });

    it("starts the saved terminals together, and lists them in the order they were saved", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      for (const sessionId of ["t1", "t2", "t3"])
        fixture.saved.save(new SavedTerminal(sessionId, "bash", "/work", false));
      const started: PromiseWithResolvers<void> = Promise.withResolvers<void>();
      fixture.spawner.hold = started.promise;

      const restoring: Promise<JsonValue> = fixture.host.handleAsync("terminal.restore", RESTORE, APP);
      await vi.waitFor(() => assert.equal(fixture.spawner.holding, 3));
      started.resolve();
      await restoring;

      assert.deepEqual((await fixture.listAsync()).map(t => t.sessionId), ["t1", "t2", "t3"]);
    });

    it("answers a panel open that comes while the last run's terminals open again with the panel terminal they bring back", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      fixture.saved.save(new SavedTerminal("t1", "bash", "/work", false));
      fixture.saved.save(new SavedTerminal("p1", "bash", "/work", true));
      const started: PromiseWithResolvers<void> = Promise.withResolvers<void>();
      fixture.spawner.hold = started.promise;

      const restoring: Promise<JsonValue> = fixture.host.handleAsync("terminal.restore", RESTORE, APP);
      await fixture.spawner.held.promise;
      const opening: Promise<string> = fixture.openAsync(panelOpen);
      started.resolve();
      await restoring;

      assert.equal(await opening, "p1");
      assert.deepEqual((await fixture.listAsync()).map(t => t.sessionId), ["t1", "p1"]);
      assert.equal(fixture.spawner.calls.length, 2);
    });

    it("opens no saved panel terminal while this run is opening one, and forgets it", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const started: PromiseWithResolvers<void> = Promise.withResolvers<void>();
      fixture.spawner.hold = started.promise;
      const opening: Promise<string> = fixture.openAsync(panelOpen);
      await fixture.spawner.held.promise;
      fixture.database.run("INSERT INTO terminals (session_id, shell_id, folder, is_panel_terminal, position) VALUES ('p1', 'bash', '/work', 1, 0)");

      await fixture.host.handleAsync("terminal.restore", RESTORE, APP);
      started.resolve();
      const panel: string = await opening;

      assert.deepEqual((await fixture.listAsync()).map(t => t.sessionId), [panel]);
      assert.deepEqual(fixture.saved.list().map(t => t.sessionId), [panel]);
    });

    it("keeps a terminal of this run that the last run's record names, and opens no second one", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const sessionId: string = await fixture.openAsync();

      await fixture.host.handleAsync("terminal.restore", RESTORE, APP);

      assert.equal(fixture.spawner.calls.length, 1);
      assert.deepEqual((await fixture.listAsync()).map(t => t.sessionId), [sessionId]);
    });

    for (const failure of [new Error("no pseudo-terminal"), "no pseudo-terminal"])
      it(`forgets and logs a terminal whose shell can't start again, failing with ${typeof failure === "string" ? "a message" : "an error"}, and opens the rest`, async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        fixture.fileSystem.folders.add("/work/src");
        fixture.saved.save(new SavedTerminal("s1", "bash", "/work/src", false));
        fixture.saved.save(new SavedTerminal("s2", "bash", "/work", false));
        const spawnAsync: FakePtySpawner["spawnAsync"] = fixture.spawner.spawnAsync.bind(fixture.spawner);
        fixture.spawner.spawnAsync = async (...args: Parameters<FakePtySpawner["spawnAsync"]>): Promise<IPtyProcess> => {
          if (args[2] === "/work/src")
            throw failure;
          return spawnAsync(...args);
        };

        assert.equal(await fixture.host.handleAsync("terminal.restore", RESTORE, APP), null);

        assert.deepEqual(fixture.log.messages, ["Terminal s1 could not be opened again: no pseudo-terminal"]);
        assert.deepEqual((await fixture.listAsync()).map(t => t.sessionId), ["s2"]);
        assert.deepEqual(fixture.saved.list().map(t => t.sessionId), ["s2"]);
      });

    it("stops opening terminals again when it ends, and keeps their records", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      fixture.saved.save(new SavedTerminal("s1", "bash", "/work", false));

      const restoring: Promise<JsonValue> = fixture.host.handleAsync("terminal.restore", RESTORE, APP);
      const ending: Promise<void> = fixture.host.endAllAsync();

      await assert.rejects(restoring, HostEndedException);
      await ending;
      assert.deepEqual(fixture.spawner.calls, []);
      assert.deepEqual(fixture.saved.list().map(t => t.sessionId), ["s1"]);
    });

    it("closes a connection after a restore its end stopped, without the restore's refusal", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      fixture.saved.save(new SavedTerminal("s1", "bash", "/work", false));
      const restoring: Promise<JsonValue> = fixture.host.handleAsync("terminal.restore", RESTORE, APP);
      const ending: Promise<void> = fixture.host.endAllAsync();
      await assert.rejects(restoring, HostEndedException);
      await ending;

      await fixture.host.closeConnectionAsync(APP.connection, null);

      assert.deepEqual(fixture.saved.list().map(t => t.sessionId), ["s1"]);
    });

    it("logs records it can't read and opens none, and logs a terminal it can't keep but still opens it", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      fixture.database.run("DROP TABLE terminals");

      assert.equal(await fixture.host.handleAsync("terminal.restore", RESTORE, APP), null);
      const sessionId: string = await fixture.openAsync();

      assert.deepEqual(fixture.log.messages, [
        "The terminals the last run left open could not be read: no such table: terminals",
        `Terminal ${sessionId} could not be kept for the next run: no such table: terminals`
      ]);
      assert.deepEqual((await fixture.listAsync()).map(t => t.sessionId), [sessionId]);
    });

    it("logs what the database threw when it isn't an error", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      fixture.database.answer("readAll", (): never => {
        throw "The database is locked.";
      });

      assert.equal(await fixture.host.handleAsync("terminal.restore", RESTORE, APP), null);

      assert.deepEqual(fixture.log.messages, ["The terminals the last run left open could not be read: The database is locked."]);
    });

    it("refuses a restore without a size", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();

      await assert.rejects(fixture.host.handleAsync("terminal.restore", null, APP), JsonException);
    });
  });

  describe("launching an app's terminal", () => {
    const launch: Record<string, JsonValue> = { shellId: "bash", folder: "/work", size: SIZE, storedLimit: 104_857_600,
      environment: { API_URL: "https://example.com", TOKEN: "secret-value" }, notice: null, command: null, opensTab: true };

    async function launchAsync(fixture: HostFixture, request: JsonValue = launch): Promise<TerminalLaunched> {
      return TerminalLaunched.fromJson(await fixture.host.handleAsync("terminal.launch", request, APP));
    }

    function showPrompt(fixture: HostFixture, process: FakePtyProcess): void {
      const nonce: string = fixture.writer.nonceFor(fixture.spawner.environments[fixture.spawner.spawned.indexOf(process)]);
      process.emitData(`\u001b]6973;A;${nonce}\u0007$ \u001b]6973;B;${nonce}\u0007`);
    }

    it("types and enters a launch's command at its shell's first prompt, not before, and answers the launch at once", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const launched: TerminalLaunched = await launchAsync(fixture, { ...launch, command: "curl -fsSL https://example.com/install.sh | bash" });
      fixture.process.emitData("Last login: today\r\n");
      await vi.waitFor(() => assert.equal(fixture.output.published.length, 1));
      const beforePrompt: readonly string[] = [...fixture.process.writes];

      showPrompt(fixture, fixture.process);

      await vi.waitFor(() => assert.deepEqual(fixture.process.writes, ["curl -fsSL https://example.com/install.sh | bash\r"]));
      assert.deepEqual(beforePrompt, []);
      assert.notEqual(launched.sessionId, null);
      await fixture.endAllAsync();
    });

    it("logs a launch's command it could not type, naming the terminal but not the command", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const launched: TerminalLaunched = await launchAsync(fixture, { ...launch, command: "npm test" });
      vi.spyOn(TerminalSession.prototype, "write").mockImplementationOnce(() => {
        throw new Error("The shell's input is closed.");
      });

      showPrompt(fixture, fixture.process);

      await vi.waitFor(() => assert.deepEqual(fixture.log.messages, [`The command of terminal ${launched.sessionId} could not be typed: The shell's input is closed.`]));
      assert.deepEqual(fixture.process.writes, []);
      await fixture.endAllAsync();
    });

    it("completes a launched terminal's commands from the PATH the app gave it, over the one it inherits, until its shell reports its own", async () => {
      const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash", PATH: "/usr/bin" });
      fixture.fileSystem.files.set("/usr/bin/grep", "");
      fixture.fileSystem.files.set("/opt/tools/grepx", "");
      const launched: TerminalLaunched = await launchAsync(fixture, { ...launch, environment: { PATH: "/opt/tools" } });

      assert.deepEqual(await fixture.host.handleAsync("terminal.complete", { sessionId: launched.sessionId, line: "gr", cursor: 2 }, APP),
        { replaceFrom: 0, isShellTab: false, items: [{ text: "grepx", label: "grepx", kind: "Command" }] });
      fixture.fileSystem.files.set("/work/bin/grepy", "");
      fixture.reportPath(fixture.process, "/work/bin");
      assert.deepEqual(await fixture.host.handleAsync("terminal.complete", { sessionId: launched.sessionId, line: "gr", cursor: 2 }, APP),
        { replaceFrom: 0, isShellTab: false, items: [{ text: "grepy", label: "grepy", kind: "Command" }] });
      await fixture.endAllAsync();
    });

    it("lists a launched terminal without a tab so, so no window opens one for it, and one with a tab as before", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const tabbed: TerminalLaunched = await launchAsync(fixture);
      const untabbed: TerminalLaunched = await launchAsync(fixture, { ...launch, opensTab: false });

      assert.deepEqual((await fixture.listAsync()).map(t => [t.sessionId, t.opensTab]), [[tabbed.sessionId, true], [untabbed.sessionId, false]]);
      await fixture.endAllAsync();
    });

    it("ends a window's earlier pages' launches without a tab when its next page starts, as on a reload, but not one with a tab, the page's own, nor another window's", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const page = (window: number, number: number): RequestClient => new RequestClient(1, window, true, number);
      const launchFromAsync = async (client: RequestClient): Promise<string | null> =>
        TerminalLaunched.fromJson(await fixture.host.handleAsync("terminal.launch", { ...launch, opensTab: false }, client)).sessionId;
      const tabbed: TerminalLaunched = await launchAsync(fixture);
      await launchFromAsync(page(1, 1));
      const startingPages: string | null = await launchFromAsync(page(1, 2));
      const otherWindows: string | null = await launchFromAsync(page(2, 1));

      assert.equal(await fixture.host.handleAsync("terminal.windowStarted", null, page(1, 2)), null);
      await fixture.host.handleAsync("terminal.windowStarted", null, COMMAND_LINE);

      assert.deepEqual((await fixture.listAsync()).map(t => t.sessionId), [tabbed.sessionId, startingPages, otherWindows]);
      assert.equal(fixture.spawner.spawned[1]?.ends, 1);
      await fixture.endAllAsync();
    });

    it("answers a window's start without waiting for another window's launch under way", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const hold: PromiseWithResolvers<void> = Promise.withResolvers<void>();
      fixture.fileSystem.hold = hold.promise;
      const launching: Promise<JsonValue> = fixture.host.handleAsync("terminal.launch", { ...launch, opensTab: false }, new RequestClient(1, 2, true, 1));
      await fixture.fileSystem.held.promise;

      const answer: JsonValue = await fixture.host.handleAsync("terminal.windowStarted", null, new RequestClient(1, 1, true, 2));
      fixture.fileSystem.hold = null;
      hold.resolve();

      assert.equal(answer, null);
      assert.notEqual(TerminalLaunched.fromJson(await launching).sessionId, null);
      await fixture.endAllAsync();
    });

    it("ends a terminal an earlier page of the window was launching without a tab when its next page starts, once the launch finishes", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const hold: PromiseWithResolvers<void> = Promise.withResolvers<void>();
      fixture.fileSystem.hold = hold.promise;
      const launching: Promise<JsonValue> = fixture.host.handleAsync("terminal.launch", { ...launch, opensTab: false }, new RequestClient(1, 1, true, 1));
      await fixture.fileSystem.held.promise;

      const starting: Promise<JsonValue> = fixture.host.handleAsync("terminal.windowStarted", null, new RequestClient(1, 1, true, 2));
      fixture.fileSystem.hold = null;
      hold.resolve();
      await launching;
      await starting;

      assert.deepEqual(await fixture.listAsync(), []);
      assert.equal(fixture.spawner.spawned[0]?.ends, 1);
      await fixture.endAllAsync();
    });

    it("ends a terminal launched without a tab when its window closes for good, but not one with a tab, nor another window's", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const tabbed: TerminalLaunched = await launchAsync(fixture);
      await launchAsync(fixture, { ...launch, opensTab: false });
      const otherWindows: TerminalLaunched = TerminalLaunched.fromJson(await fixture.host.handleAsync("terminal.launch", { ...launch, opensTab: false },
        new RequestClient(1, 2, true)));

      await fixture.host.closeConnectionAsync(1, 1);

      assert.deepEqual((await fixture.listAsync()).map(t => t.sessionId), [tabbed.sessionId, otherWindows.sessionId]);
      assert.equal(fixture.spawner.spawned[1]?.ends, 1);
      await fixture.endAllAsync();
    });

    it("types nothing for a launch without a command, nor into a shell that ended or a terminal that closed before its first prompt", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      await launchAsync(fixture);
      const plain: FakePtyProcess = fixture.process;
      showPrompt(fixture, plain);
      await launchAsync(fixture, { ...launch, command: "npm test" });
      const ended: FakePtyProcess = fixture.process;
      ended.exit(1);
      const closedId: string = (await launchAsync(fixture, { ...launch, command: "npm test" })).sessionId ?? "";
      const closed: FakePtyProcess = fixture.process;
      closed.isEndable = false;
      await fixture.host.handleAsync("terminal.close", { sessionId: closedId }, APP);
      showPrompt(fixture, closed);
      await vi.waitFor(() => assert.equal(fixture.launchCommandEnded.published.length, 2));

      assert.deepEqual([plain.writes, ended.writes, closed.writes], [[], [], []]);
      await fixture.endAllAsync();
    });

    for (const isEndable of [true, false])
      it(`types nothing into the restarted shell of a launch that restarts before its first prompt, when the old shell ${isEndable ? "ends" : "outlives its kill"}`, async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const sessionId: string = (await launchAsync(fixture, { ...launch, command: "npm test" })).sessionId ?? "";
        const old: FakePtyProcess = fixture.process;
        old.isEndable = isEndable;

        await fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP);
        const restarted: FakePtyProcess = fixture.process;
        await vi.waitFor(() => assert.equal(fixture.launchCommandEnded.published.length, 1));
        showPrompt(fixture, restarted);

        assert.notEqual(restarted, old);
        assert.deepEqual([old.writes, restarted.writes], [[], []]);
        await fixture.endAllAsync();
      });

    it("gives up a launch's wait for its shell when its terminal closes or the host ends, though the shell outlives its kill, leaving no timer behind", async () => {
      vi.useFakeTimers();
      const fixture: HostFixture = await HostFixture.createAsync();
      fixture.spawner.isEndable = false;
      const timers: number = vi.getTimerCount();
      const closedId: string = (await launchAsync(fixture, { ...launch, command: "npm test" })).sessionId ?? "";
      const waiting: number = vi.getTimerCount();
      await fixture.host.handleAsync("terminal.close", { sessionId: closedId }, APP);
      const afterClose: number = vi.getTimerCount();
      await launchAsync(fixture, { ...launch, command: "npm test" });

      await fixture.endAllAsync();

      assert.deepEqual([waiting > timers, afterClose, vi.getTimerCount()], [true, timers, timers]);
    });

    it("types a command into a shell without the integration once its first output stops for half a second, or at the wait's end", async () => {
      vi.useFakeTimers();
      const fixture: HostFixture = await HostFixture.createAsync("win32", "10.0.26100", { SystemRoot: "C:\\Windows" });
      fixture.fileSystem.folders.add("C:\\work");
      await launchAsync(fixture, { ...launch, shellId: "cmd", folder: "C:\\work", environment: {}, command: "winget install Tool" });
      const prompted: FakePtyProcess = fixture.process;
      await launchAsync(fixture, { ...launch, shellId: "cmd", folder: "C:\\work", environment: {}, command: "winget install Other" });
      const silent: FakePtyProcess = fixture.process;

      prompted.emitData("Microsoft Windows\r\n");
      await vi.advanceTimersByTimeAsync(400);
      prompted.emitData("C:\\work>");
      await vi.advanceTimersByTimeAsync(400);
      const whileDrawing: readonly string[] = [...prompted.writes];
      await vi.advanceTimersByTimeAsync(200);
      const afterSettling: readonly string[] = [...prompted.writes];
      await vi.advanceTimersByTimeAsync(8_500);
      const silentBefore: readonly string[] = [...silent.writes];
      await vi.advanceTimersByTimeAsync(1_500);

      assert.deepEqual([whileDrawing, afterSettling], [[], ["winget install Tool\r"]]);
      assert.deepEqual([silentBefore, silent.writes], [[], ["winget install Other\r"]]);
      await fixture.endAllAsync();
    });

    it("launches a Windows shell of the kinds when a WSL distribution is the Default shell, the distribution when it is of them or none are given, " +
      "and nothing when none of them is installed", async () => {
      const fixture: HostFixture = await HostFixture.createAsync("win32", "10.0.26100", { SystemRoot: "C:\\Windows" });
      fixture.fileSystem.folders.add("C:\\work");
      fixture.runner.answers.set("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
        Promise.resolve(`${Buffer.from("Ubuntu").toString("base64")} 1\r\nEnd\r\n`));
      const signIn: Record<string, JsonValue> = { ...launch, shellId: "wsl-Ubuntu", folder: "C:\\work", environment: {} };

      for (const shellKinds of [["PowerShell", "CommandPrompt"], ["Wsl", "PowerShell"], []])
        await launchAsync(fixture, shellKinds.length === 0 ? signIn : { ...signIn, shellKinds });
      await assert.rejects(launchAsync(fixture, { ...signIn, shellKinds: ["Fish"] }),
        (error: unknown) => error instanceof ShellKindNotFoundException && error.message === "No installed shell is of the kinds Fish.");

      assert.deepEqual(fixture.spawner.calls.map(t => t.split(" [")[0]),
        ["C:\\Windows\\System32\\cmd.exe", "C:\\Windows\\System32\\wsl.exe", "C:\\Windows\\System32\\wsl.exe"]);
      assert.equal((await fixture.listAsync()).length, 3);
      await fixture.endAllAsync();
    });

    it("lays the app's variables over the shell's environment, under the integration's, and keeps the terminal for no next run", async () => {
      const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash", HOME: "/home/a", API_URL: "https://old.example.com" });

      const launched: TerminalLaunched = await launchAsync(fixture);
      fixture.reportCwd(fixture.process, "/work/src");

      const sessionId: string = launched.sessionId ?? "";
      assert.equal(launched.missingFolder, null);
      assert.deepEqual(fixture.spawner.calls, ["/bin/bash [--init-file /tmp/noldova-terminal-1/noldova.bash -i] in /work at 80x24"]);
      const { NOLDOVA_TERMINAL_NONCE_FILE: nonceFile, ...shellEnvironment } = fixture.spawner.environments[0] ?? {};
      assert.match(nonceFile ?? "", /^\/tmp\/noldova-terminal-1\/nonce-[\da-f]{32}$/u);
      assert.match(fixture.writer.nonceFor(fixture.spawner.environments[0]), /^[\da-f]{32}$/u);
      assert.deepEqual(shellEnvironment, { SHELL: "/bin/bash", HOME: "/home/a", API_URL: "https://example.com", TOKEN: "secret-value",
        TERM: "xterm-256color", COLORTERM: "truecolor", NOLDOVA_TERMINAL_LOGIN: "1" });
      assert.deepEqual((await fixture.listAsync()).map(t => [t.sessionId, t.isAgentTerminal, t.isPanelTerminal, t.owner]), [[sessionId, false, false, null]]);
      assert.deepEqual(fixture.saved.list(), []);
      assert.deepEqual(fixture.cwdChanged.published, [{ sessionId, cwd: "/work/src" }]);
      assert.deepEqual(fixture.log.messages, []);
      await fixture.endAllAsync();
    });

    it("shows the notice above the shell's first output, a line for each of its lines, and types nothing into the shell", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();

      const launched: TerminalLaunched = await launchAsync(fixture, { ...launch, notice: "Run login to sign in.\nThen start it.\r\nDone\u001b[2J" });

      assert.deepEqual(fixture.spawner.inheritsCursor, [true]);
      assert.deepEqual(fixture.process.writes, []);
      assert.equal((await fixture.notesAsync(1)).get(launched.sessionId ?? ""), "\u001b[2;3mRun login to sign in.\u001b[0m\r\n"
        + "\u001b[2;3mThen start it.\u001b[0m\r\n\u001b[2;3mDone?[2J\u001b[0m\r\n");
    });

    it("has a Windows shell with an integration print the notice, handed to it as a variable, rather than the runtime", async () => {
      const fixture: HostFixture = await HostFixture.createAsync("win32", "10.0.26100", { SystemRoot: "C:\\Windows" });
      fixture.fileSystem.files.set("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", "");
      fixture.fileSystem.folders.add("C:\\work");

      await launchAsync(fixture, { ...launch, shellId: "powershell", folder: "C:\\work", notice: "Run login.\nThen start it." });
      fixture.process.emitData("PS> ");

      assert.deepEqual(fixture.spawner.inheritsCursor, [false]);
      assert.equal(fixture.spawner.environments[0]?.["NOLDOVA_TERMINAL_NOTE"],
        "\u001b[2;3mRun login.\u001b[0m\r\n\u001b[2;3mThen start it.\u001b[0m\r\n");
      await vi.waitFor(() => assert.equal(fixture.output.published.length, 1));
      assert.equal(fixture.outputData()[0], "PS> ");
    });

    it("ends a launched terminal as closed when it closes though its shell outlives the kill, once even when the shell exits later, and a person's terminal without a word", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const person: string = await fixture.openAsync();
      fixture.process.isEndable = false;
      const sessionId: string = (await launchAsync(fixture)).sessionId ?? "";
      fixture.process.isEndable = false;

      await fixture.host.handleAsync("terminal.close", { sessionId: person }, APP);
      await fixture.host.handleAsync("terminal.close", { sessionId }, APP);
      fixture.process.exit(0);

      assert.deepEqual(fixture.exited.published, [{ sessionId, exit: { exitCode: null, endedBy: "Close" } }]);
      assert.deepEqual(fixture.log.messages, [`The shell of terminal ${person}, process 1000, or a process it started, did not end in time.`,
        `The shell of terminal ${sessionId}, process 1001, or a process it started, did not end in time.`]);
    });

    it("ends a launched terminal once as closed when its shell exits while the close removes its stored lines", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const sessionId: string = (await launchAsync(fixture)).sessionId ?? "";
      fixture.process.isEndable = false;
      const held: PromiseWithResolvers<void> = Promise.withResolvers<void>();
      const removal: PromiseWithResolvers<readonly unknown[]> = Promise.withResolvers<readonly unknown[]>();
      vi.spyOn(TerminalSession.prototype, "disposeAsync").mockImplementation(() => {
        held.resolve();
        return removal.promise;
      });

      const closing: Promise<unknown> = fixture.host.handleAsync("terminal.close", { sessionId }, APP);
      await held.promise;
      fixture.process.exit(0);
      removal.resolve([]);
      await closing;

      assert.deepEqual(fixture.exited.published, [{ sessionId, exit: { exitCode: null, endedBy: "Close" } }]);
    });

    it("answers a folder that no longer exists, the home folder too, and opens nothing", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();

      assert.deepEqual((await launchAsync(fixture, { ...launch, folder: "/gone" })).toJson(), { sessionId: null, missingFolder: "/gone" });
      assert.deepEqual((await launchAsync(fixture, { ...launch, folder: null })).toJson(), { sessionId: null, missingFolder: "/home/a" });
      assert.deepEqual(fixture.spawner.calls, []);
      assert.deepEqual(await fixture.listAsync(), []);
      assert.deepEqual(fixture.log.messages, []);
    });

    it("opens a null folder in the home folder", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      fixture.fileSystem.folders.add("/home/a");

      await launchAsync(fixture, { ...launch, folder: null });

      assert.match(fixture.spawner.calls[0] ?? "", / in \/home\/a at 80x24$/u);
    });

    it("refuses a folder absolute only on Windows, and a variable the terminal sets itself, naming it but never its value", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();

      await assert.rejects(launchAsync(fixture, { ...launch, folder: "C:\\work" }),
        (error: unknown) => error instanceof ArgumentException && error.parameterName === "folder");
      await assert.rejects(launchAsync(fixture, { ...launch, environment: { ZDOTDIR: "secret-value" } }),
        (error: unknown) => error instanceof JsonException && error.message.includes("environment.ZDOTDIR")
          && !error.message.includes("secret-value"));
      assert.deepEqual(fixture.spawner.calls, []);
    });

    it("restarts a launched shell with the app's variables again, from the environment as it reads now", async () => {
      const reads: Readonly<Record<string, string | undefined>>[] = [{ SHELL: "/bin/bash", GREETING: "first" }, { SHELL: "/bin/bash", GREETING: "second" }];
      const source: IEnvironmentSource = { start: () => undefined, readAsync: () => Promise.resolve(reads.shift() ?? {}), end: () => undefined };
      const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash" }, source);
      const sessionId: string = (await launchAsync(fixture)).sessionId ?? "";
      fixture.process.exit(0);

      await fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP);

      assert.equal(fixture.spawner.environments[1]?.["GREETING"], "second");
      assert.equal(fixture.spawner.environments[1]?.["TOKEN"], "secret-value");
      assert.deepEqual(fixture.saved.list(), []);
      await fixture.endAllAsync();
    });

    it("doesn't end a launch when its running shell restarts, and ends it once when the terminal then closes", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const sessionId: string = (await launchAsync(fixture)).sessionId ?? "";

      await fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP);
      const afterRestart: JsonValue[] = [...fixture.exited.published];
      await fixture.host.handleAsync("terminal.close", { sessionId }, APP);

      assert.deepEqual(afterRestart, []);
      assert.deepEqual(fixture.exited.published, [{ sessionId, exit: { exitCode: null, endedBy: "Close" } }]);
      assert.equal(fixture.spawner.environments[1]?.["TOKEN"], "secret-value");
    });

    it("ends a launch once as closed when it closes while a restart has ended its shell and waits for the new one", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const sessionId: string = (await launchAsync(fixture)).sessionId ?? "";
      const release: PromiseWithResolvers<void> = Promise.withResolvers<void>();
      fixture.spawner.hold = release.promise;

      const restarting: Promise<JsonValue> = fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP);
      await fixture.spawner.held.promise;
      const whileRestarting: JsonValue[] = [...fixture.exited.published];
      await fixture.host.handleAsync("terminal.close", { sessionId }, APP);
      release.resolve();

      await assert.rejects(restarting, SessionNotFoundException);
      assert.deepEqual(whileRestarting, []);
      assert.deepEqual(fixture.exited.published, [{ sessionId, exit: { exitCode: null, endedBy: "Close" } }]);
    });

    it("tells the windows once that a launch's command ended, with its exit code, and not of an end before it was typed or the person's commands after it", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const passedId: string = (await launchAsync(fixture, { ...launch, command: "tool auth login" })).sessionId ?? "";
      const passed: FakePtyProcess = fixture.process;
      const failedId: string = (await launchAsync(fixture, { ...launch, command: "npm test" })).sessionId ?? "";
      const failed: FakePtyProcess = fixture.process;
      const nonce = (process: FakePtyProcess): string =>
        fixture.writer.nonceFor(fixture.spawner.environments[fixture.spawner.spawned.indexOf(process)]);
      passed.emitData(`\u001b]6973;D;${nonce(passed)};5\u0007`);
      showPrompt(fixture, passed);
      showPrompt(fixture, failed);
      await vi.waitFor(() => assert.deepEqual([passed.writes.length, failed.writes.length], [1, 1]));

      passed.emitData(`\r\n\u001b]6973;C;${nonce(passed)}\u0007Signed in.\r\n\u001b]6973;D;${nonce(passed)};0\u0007`);
      failed.emitData(`\r\n\u001b]6973;C;${nonce(failed)}\u0007\u001b]6973;D;${nonce(failed)};1\u0007`);
      passed.emitData(`\u001b]6973;C;${nonce(passed)}\u0007\u001b]6973;D;${nonce(passed)};2\u0007`);

      assert.deepEqual(fixture.launchCommandEnded.published, [{ sessionId: passedId, exitCode: 0 }, { sessionId: failedId, exitCode: 1 }]);
      assert.deepEqual(fixture.exited.published, []);
      await fixture.endAllAsync();
    });

    it("tells the windows a launch's command ended without a code when the person typed before it went in, not for a window's focus report or color reply", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const typedId: string = (await launchAsync(fixture, { ...launch, command: "tool auth login" })).sessionId ?? "";
      const typed: FakePtyProcess = fixture.process;
      const repliedId: string = (await launchAsync(fixture, { ...launch, command: "tool auth login" })).sessionId ?? "";
      const replied: FakePtyProcess = fixture.process;
      const functionKeyId: string = (await launchAsync(fixture, { ...launch, command: "tool auth login" })).sessionId ?? "";
      const functionKey: FakePtyProcess = fixture.process;
      const nonce = (process: FakePtyProcess): string =>
        fixture.writer.nonceFor(fixture.spawner.environments[fixture.spawner.spawned.indexOf(process)]);
      await fixture.host.handleAsync("terminal.input", { sessionId: typedId, data: "\r" }, APP);
      await fixture.host.handleAsync("terminal.input", { sessionId: repliedId, data: "\u001b[I\u001b]11;rgb:0000/0000/0000\u001b\\" }, APP);
      await fixture.host.handleAsync("terminal.input", { sessionId: repliedId, data: "\u001b[O\u001b]10;rgb:ffff/ffff/ffff\u0007" }, APP);
      await fixture.host.handleAsync("terminal.input", { sessionId: functionKeyId, data: "\u001b[1;2R" }, APP);
      for (const process of [typed, replied, functionKey])
        showPrompt(fixture, process);
      await vi.waitFor(() => assert.deepEqual([typed.writes.length, replied.writes.length, functionKey.writes.length], [2, 3, 2]));

      for (const process of [typed, replied, functionKey])
        process.emitData(`\r\n\u001b]6973;C;${nonce(process)}\u0007\u001b]6973;D;${nonce(process)};0\u0007`);

      assert.deepEqual(fixture.launchCommandEnded.published,
        [{ sessionId: typedId, exitCode: null }, { sessionId: functionKeyId, exitCode: null }, { sessionId: repliedId, exitCode: 0 }]);
      await fixture.endAllAsync();
    });

    it("tells the windows a launch's command ended without a code once it is typed into a shell whose integration never marked", async () => {
      vi.useFakeTimers();
      const fixture: HostFixture = await HostFixture.createAsync();
      const sessionId: string = (await launchAsync(fixture, { ...launch, command: "npm test" })).sessionId ?? "";

      fixture.process.emitData("$ ");
      await vi.advanceTimersByTimeAsync(9_000);
      const beforeTyping: JsonValue[] = [...fixture.launchCommandEnded.published];
      await vi.advanceTimersByTimeAsync(1_000);

      assert.deepEqual([beforeTyping, fixture.process.writes], [[], ["npm test\r"]]);
      assert.deepEqual(fixture.launchCommandEnded.published, [{ sessionId, exitCode: null }]);
      await fixture.endAllAsync();
    });

    it("waits past 10 seconds for a shell with the integration that has shown no text yet, as Windows PowerShell on a busy computer, " +
      "and types the launch's command at its first prompt, so its end comes with its code", async () => {
      vi.useFakeTimers();
      const fixture: HostFixture = await HostFixture.createAsync();
      const sessionId: string = (await launchAsync(fixture, { ...launch, command: "npm test" })).sessionId ?? "";
      const nonce: string = fixture.writer.nonceFor(fixture.spawner.environments[fixture.spawner.spawned.indexOf(fixture.process)]);
      fixture.process.emitData("\u001b[?9001h\u001b[?1004h\u001b]0;powershell.exe\u001b\\");

      await vi.advanceTimersByTimeAsync(20_000);
      const whileStarting: readonly string[] = [...fixture.process.writes];
      fixture.process.emitData(`\u001b]6973;L;${nonce}\u0007`);
      await vi.advanceTimersByTimeAsync(5_000);
      const afterLoaded: readonly string[] = [...fixture.process.writes];
      showPrompt(fixture, fixture.process);
      await vi.advanceTimersByTimeAsync(0);
      fixture.process.emitData(`\r\n\u001b]6973;C;${nonce}\u0007\u001b]6973;D;${nonce};3\u0007`);

      assert.deepEqual([whileStarting, afterLoaded, fixture.process.writes], [[], [], ["npm test\r"]]);
      assert.deepEqual(fixture.launchCommandEnded.published, [{ sessionId, exitCode: 3 }]);
      vi.useRealTimers();
      await fixture.endAllAsync();
    });

    it("types a launch's command into a shell whose integration loaded but never ended its first prompt 60 seconds after its loaded mark, and tells the windows it ended without a code", async () => {
      vi.useFakeTimers();
      const fixture: HostFixture = await HostFixture.createAsync();
      const sessionId: string = (await launchAsync(fixture, { ...launch, command: "npm test" })).sessionId ?? "";
      const nonce: string = fixture.writer.nonceFor(fixture.spawner.environments[fixture.spawner.spawned.indexOf(fixture.process)]);
      fixture.process.emitData(`\u001b]6973;L;${nonce}\u0007\u001b]6973;P;${nonce};Cwd=/work\u0007\u001b]6973;A;${nonce}\u0007PS /work> `);

      await vi.advanceTimersByTimeAsync(59_999);
      const beforeLimit: readonly string[] = [...fixture.process.writes];
      await vi.advanceTimersByTimeAsync(1);

      assert.deepEqual([beforeLimit, fixture.process.writes, fixture.launchCommandEnded.published], [[], ["npm test\r"], [{ sessionId, exitCode: null }]]);
      vi.useRealTimers();
      await fixture.endAllAsync();
    });

    it("types into a shell with the integration that shows no text at all once 60 seconds pass, and not before", async () => {
      vi.useFakeTimers();
      const fixture: HostFixture = await HostFixture.createAsync();
      await launchAsync(fixture, { ...launch, command: "npm test" });

      await vi.advanceTimersByTimeAsync(59_999);
      const beforeLimit: readonly string[] = [...fixture.process.writes];
      await vi.advanceTimersByTimeAsync(1);

      assert.deepEqual([beforeLimit, fixture.process.writes], [[], ["npm test\r"]]);
      await fixture.endAllAsync();
    });

    it("types into a slow shell with the integration that shows its own prompt late and never marks 10 seconds after that first text, and not before", async () => {
      vi.useFakeTimers();
      const fixture: HostFixture = await HostFixture.createAsync();
      await launchAsync(fixture, { ...launch, command: "npm test" });

      await vi.advanceTimersByTimeAsync(15_000);
      fixture.process.emitData("custom> ");
      await vi.advanceTimersByTimeAsync(9_999);
      const beforeLimit: readonly string[] = [...fixture.process.writes];
      await vi.advanceTimersByTimeAsync(1);

      assert.deepEqual([beforeLimit, fixture.process.writes], [[], ["npm test\r"]]);
      await fixture.endAllAsync();
    });

    it("keeps waiting for the integration of a slow shell that shows text, then rests for seconds before its loaded mark, and types at its first prompt, so its end comes with its code", async () => {
      vi.useFakeTimers();
      const fixture: HostFixture = await HostFixture.createAsync();
      const sessionId: string = (await launchAsync(fixture, { ...launch, command: "npm test" })).sessionId ?? "";
      const nonce: string = fixture.writer.nonceFor(fixture.spawner.environments[fixture.spawner.spawned.indexOf(fixture.process)]);

      await vi.advanceTimersByTimeAsync(15_000);
      fixture.process.emitData("Windows PowerShell\r\nCopyright (C) Microsoft Corporation. All rights reserved.\r\n");
      await vi.advanceTimersByTimeAsync(3_000);
      const whileResting: readonly string[] = [...fixture.process.writes];
      fixture.process.emitData(`\u001b]6973;L;${nonce}\u0007`);
      await vi.advanceTimersByTimeAsync(2_000);
      const afterLoaded: readonly string[] = [...fixture.process.writes];
      showPrompt(fixture, fixture.process);
      await vi.advanceTimersByTimeAsync(0);
      fixture.process.emitData(`\r\n\u001b]6973;C;${nonce}\u0007\u001b]6973;D;${nonce};3\u0007`);

      assert.deepEqual([whileResting, afterLoaded, fixture.process.writes], [[], [], ["npm test\r"]]);
      assert.deepEqual(fixture.launchCommandEnded.published, [{ sessionId, exitCode: 3 }]);
      vi.useRealTimers();
      await fixture.endAllAsync();
    });

    it("tells the windows a launch's command ended without a code when its next prompt starts on a new line without its end mark, not at a prompt redrawn in place, and not of a later command's end", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const sessionId: string = (await launchAsync(fixture, { ...launch, command: "(exit 3)" })).sessionId ?? "";
      const nonce: string = fixture.writer.nonceFor(fixture.spawner.environments[0]);
      showPrompt(fixture, fixture.process);
      await vi.waitFor(() => assert.equal(fixture.process.writes.length, 1));

      fixture.process.emitData(`\r\u001b]6973;A;${nonce}\u0007$ \u001b]6973;B;${nonce}\u0007(exit 3)`);
      const redrawn: JsonValue[] = [...fixture.launchCommandEnded.published];
      fixture.process.emitData(`\r\n\u001b]6973;P;${nonce};Cwd=/work\u0007\u001b]6973;A;${nonce}\u0007$ \u001b]6973;B;${nonce}\u0007`);
      fixture.process.emitData(`true\r\n\u001b]6973;C;${nonce}\u0007\u001b]6973;D;${nonce};0\u0007\u001b]6973;A;${nonce}\u0007$ `);

      assert.deepEqual([redrawn, fixture.launchCommandEnded.published], [[], [{ sessionId, exitCode: null }]]);
      await fixture.endAllAsync();
    });

    it("tells the windows a launch's command ended without a code when its shell restarts after it or its terminal closes before it is typed, not for a launch without one", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      await launchAsync(fixture);
      showPrompt(fixture, fixture.process);
      const restartedId: string = (await launchAsync(fixture, { ...launch, command: "npm test" })).sessionId ?? "";
      showPrompt(fixture, fixture.process);
      await vi.waitFor(() => assert.equal(fixture.process.writes.length, 1));
      await fixture.host.handleAsync("terminal.restart", { sessionId: restartedId, size: SIZE }, APP);
      const closedId: string = (await launchAsync(fixture, { ...launch, command: "npm test" })).sessionId ?? "";
      await fixture.host.handleAsync("terminal.close", { sessionId: closedId }, APP);

      await vi.waitFor(() => assert.equal(fixture.launchCommandEnded.published.length, 2));
      assert.deepEqual(fixture.launchCommandEnded.published, [{ sessionId: restartedId, exitCode: null }, { sessionId: closedId, exitCode: null }]);
      await fixture.endAllAsync();
    });

    it("tells the windows a launch's command ended without a code once it is typed into a shell without the integration", async () => {
      vi.useFakeTimers();
      const fixture: HostFixture = await HostFixture.createAsync("win32", "10.0.26100", { SystemRoot: "C:\\Windows" });
      fixture.fileSystem.folders.add("C:\\work");
      const sessionId: string = (await launchAsync(fixture, { ...launch, shellId: "cmd", folder: "C:\\work", environment: {}, command: "winget install Tool" }))
        .sessionId ?? "";

      fixture.process.emitData("C:\\work>");
      await vi.advanceTimersByTimeAsync(400);
      const beforeTyping: JsonValue[] = [...fixture.launchCommandEnded.published];
      await vi.advanceTimersByTimeAsync(200);

      assert.deepEqual([beforeTyping, fixture.process.writes], [[], ["winget install Tool\r"]]);
      assert.deepEqual(fixture.launchCommandEnded.published, [{ sessionId, exitCode: null }]);
      await fixture.endAllAsync();
    });

    it("on Windows, lets a variable replace the one whose name matches in any case", async () => {
      const fixture: HostFixture = await HostFixture.createAsync("win32", "10.0.26100", { SystemRoot: "C:\\Windows", Path: "C:\\old" });
      fixture.fileSystem.folders.add("C:\\work");

      await launchAsync(fixture, { ...launch, shellId: "cmd", folder: "C:\\work", environment: { PATH: "C:\\new" } });

      assert.equal(fixture.spawner.environments[0]?.["PATH"], "C:\\new");
      assert.equal(Object.keys(fixture.spawner.environments[0] ?? {}).filter(t => t.toUpperCase() === "PATH").length, 1);
    });

    it("on Linux and macOS, keeps a variable whose name differs only in case", async () => {
      const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash", Path: "/old" });

      await launchAsync(fixture, { ...launch, environment: { PATH: "/new" } });

      assert.equal(fixture.spawner.environments[0]?.["Path"], "/old");
      assert.equal(fixture.spawner.environments[0]?.["PATH"], "/new");
    });
  });

  describe("running an app's commands in a terminal of its owner", () => {
    const OWNER: string = "example.chat/42";
    const run: Record<string, JsonValue> = { owner: OWNER, command: "npm test", folder: "/work", shellKinds: [], shellId: null, size: SIZE,
      storedLimit: 104_857_600, sessionId: null, whenBusy: "Refuse", opensTab: true };

    async function runAsync(fixture: HostFixture, request: Record<string, JsonValue> = {}): Promise<TerminalRunResult> {
      return TerminalRunResult.fromJson(await fixture.host.handleAsync("terminal.run", { ...run, ...request }, APP));
    }

    async function openNewAsync(fixture: HostFixture, request: Record<string, JsonValue> = {}, isShown: boolean = true):
      Promise<OpeningRun> {
      if (isShown)
        await fixture.host.handleAsync("terminal.showOwner", { owner: request["owner"] ?? OWNER }, APP);
      const listed: number = (await fixture.listAsync()).length;
      const spawning: Promise<FakePtyProcess> = fixture.spawner.nextSpawnAsync();
      const result: Promise<TerminalRunResult> = runAsync(fixture, request);
      const answered: Promise<string> = result.then(t => JSON.stringify(t.toJson()));
      await Promise.race([vi.waitFor(async () => assert.equal((await fixture.listAsync()).length, listed + 1)),
        answered.then(t => assert.fail(`The run answered ${t} without opening a terminal.`))]);
      const opened: TerminalSummary | undefined = (await fixture.listAsync()).at(-1);
      assert.ok(opened !== undefined);
      return new OpeningRun(result, opened.sessionId, spawning);
    }

    async function readAsync(spawning: Promise<FakePtyProcess>): Promise<FakePtyProcess> {
      const process: FakePtyProcess = await spawning;
      await vi.waitFor(() => assert.ok(process.isRead));
      return process;
    }

    async function startNewAsync(fixture: HostFixture, request: Record<string, JsonValue> = {}): Promise<StartedRun> {
      const { result, sessionId, spawning } = await openNewAsync(fixture, request);
      await fixture.host.handleAsync("terminal.resize", { sessionId, size: PANE_SIZE }, APP);
      return new StartedRun(result, sessionId, await readAsync(spawning));
    }

    async function runNewAsync(fixture: HostFixture, request: Record<string, JsonValue> = {}): Promise<TerminalRunResult> {
      const { result, process } = await startNewAsync(fixture, request);
      showPrompt(fixture, process);
      const answer: TerminalRunResult = await result;
      process.emitData(`\r\n\u001b]6973;C;${nonceOf(fixture, process)}\u0007`);
      return answer;
    }

    function nonceOf(fixture: HostFixture, process: FakePtyProcess): string {
      return fixture.writer.nonceFor(fixture.spawner.environments[fixture.spawner.spawned.indexOf(process)]);
    }

    function showPrompt(fixture: HostFixture, process: FakePtyProcess, isBracketed: boolean = true): void {
      const nonce: string = nonceOf(fixture, process);
      process.emitData(`\u001b]6973;A;${nonce}\u0007$ \u001b]6973;B;${nonce}\u0007${isBracketed ? "\u001b[?2004h" : ""}`);
    }

    async function openFreeAsync(fixture: HostFixture, owner: string = OWNER): Promise<OpenedTerminal> {
      const sessionId: string = await fixture.openAsync(ownedOpen(owner));
      const process: FakePtyProcess = fixture.process;
      showPrompt(fixture, process);
      return new OpenedTerminal(sessionId, process);
    }

    async function watchPasteReadAsync(fixture: HostFixture, sessionId: string): Promise<PromiseWithResolvers<void>> {
      await vi.waitFor(() => assert.equal(fixture.host.findTerminal(sessionId)?.isFree, true));
      const session: TerminalSession | undefined = fixture.host.findTerminal(sessionId)?.session;
      assert.ok(session !== undefined);
      const reading: PromiseWithResolvers<void> = Promise.withResolvers<void>();
      const isBracketedPasteAsync: () => Promise<boolean> = session.isBracketedPasteAsync.bind(session);
      vi.spyOn(session, "isBracketedPasteAsync").mockImplementation(() => {
        reading.resolve();
        return isBracketedPasteAsync();
      });
      return reading;
    }

    it("types the commands into the owner's newest free terminal of the kinds as one bracketed paste, then Enter once, never logging them", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { process: older } = await openFreeAsync(fixture);
      const { sessionId: newestId, process: newest } = await openFreeAsync(fixture);

      const result: TerminalRunResult = await runAsync(fixture, { command: "npm install\r\n\tnpm test\n\n", shellKinds: ["Zsh", "Bash"] });

      assert.deepEqual(newest.writes, ["\u001b[200~npm install\r\tnpm test\u001b[201~\r"]);
      assert.deepEqual([result.sessionId, result.outcome, older.writes, fixture.spawner.spawned.length], [newestId, "Typed", [], 2]);
      assert.match(result.runId ?? "", /^[\da-f-]{36}$/u);
      assert.ok(fixture.log.messages.every(t => !t.includes("npm")));
      await fixture.endAllAsync();
    });

    it("types each line ended by Enter into a shell that didn't ask for bracketed pastes, and refuses commands holding a tab there", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const sessionId: string = await fixture.openAsync(ownedOpen(OWNER));
      const process: FakePtyProcess = fixture.process;
      showPrompt(fixture, process, false);

      const tabbed: TerminalRunResult = await runAsync(fixture, { command: "for f in *; do\n\techo \"$f\"\ndone" });
      const typed: TerminalRunResult = await runAsync(fixture, { command: "for f in *; do\n  echo \"$f\"\ndone" });

      assert.deepEqual([tabbed.toJson(), typed.sessionId, typed.outcome], [{ sessionId, outcome: "Tab", runId: null, endedRuns: [] }, sessionId, "Typed"]);
      assert.match(typed.runId ?? "", /^[\da-f-]{36}$/u);
      assert.deepEqual(process.writes, ["for f in *; do\r  echo \"$f\"\rdone\r"]);
      await fixture.endAllAsync();
    });

    it("drops the blank lines at the commands' start, so the first one stays on the prompt's line, keeping its indentation and later lines, and a tab only in those lines refuses nothing", async () => {
      const bracketed: HostFixture = await HostFixture.createAsync();
      const { process: pasted } = await openFreeAsync(bracketed);
      const plain: HostFixture = await HostFixture.createAsync();
      await plain.openAsync(ownedOpen(OWNER));
      const typed: FakePtyProcess = plain.process;
      showPrompt(plain, typed, false);
      const command: string = "\n  \t\r\n\r\n  ls\n\n  pwd\n";

      await runAsync(bracketed, { command });
      await runAsync(plain, { command });

      assert.deepEqual([pasted.writes, typed.writes], [["\u001b[200~  ls\r\r  pwd\u001b[201~\r"], ["  ls\r\r  pwd\r"]]);
      await bracketed.endAllAsync();
      await plain.endAllAsync();
    });

    it("types nothing when the person types into the picked terminal before the commands go in, answering Input", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { sessionId, process: free } = await openFreeAsync(fixture);
      const reading: PromiseWithResolvers<void> = await watchPasteReadAsync(fixture, sessionId);

      const result: Promise<TerminalRunResult> = runAsync(fixture);
      await reading.promise;
      await fixture.host.handleAsync("terminal.input", { sessionId, data: "rm -rf " }, APP);

      assert.deepEqual([(await result).toJson(), free.writes], [{ sessionId, outcome: "Input", runId: null, endedRuns: [] }, ["rm -rf "]]);
      await fixture.endAllAsync();
    });

    it("types into the picked terminal when its pane sends a focus report before the commands go in, which is no key of the person's", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { sessionId, process: free } = await openFreeAsync(fixture);
      const reading: PromiseWithResolvers<void> = await watchPasteReadAsync(fixture, sessionId);

      const result: Promise<TerminalRunResult> = runAsync(fixture);
      await reading.promise;
      await fixture.host.handleAsync("terminal.input", { sessionId, data: "\u001b[O" }, APP);

      assert.deepEqual([(await result).outcome, free.writes], ["Typed", ["\u001b[O", "\u001b[200~npm test\u001b[201~\r"]]);
      await fixture.endAllAsync();
    });

    it("types nothing into a new terminal the person types into before its prompt, answering Input", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { result, process } = await startNewAsync(fixture);
      const [summary] = await fixture.listAsync();
      assert.ok(summary !== undefined, "The run opened no terminal.");

      await fixture.host.handleAsync("terminal.input", { sessionId: summary.sessionId, data: "rm -rf " }, APP);
      showPrompt(fixture, process);

      assert.deepEqual([(await result).toJson(), process.writes], [{ sessionId: summary.sessionId, outcome: "Input", runId: null, endedRuns: [] }, ["rm -rf "]]);
      await fixture.endAllAsync();
    });

    it("types nothing when the picked terminal's prompt line holds text by the time the commands would go in, answering Input", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { sessionId, process: free } = await openFreeAsync(fixture);
      const reading: PromiseWithResolvers<void> = await watchPasteReadAsync(fixture, sessionId);

      const result: Promise<TerminalRunResult> = runAsync(fixture);
      await reading.promise;
      free.emitData("git push");

      assert.deepEqual([(await result).toJson(), free.writes], [{ sessionId, outcome: "Input", runId: null, endedRuns: [] }, []]);
      await fixture.endAllAsync();
    });

    it("types nothing when a new terminal's prompt line holds text by the time the commands would go in, answering Input", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { result, process } = await startNewAsync(fixture);
      const nonce: string = nonceOf(fixture, process);

      process.emitData(`\u001b]6973;A;${nonce}\u0007$ \u001b]6973;B;${nonce}\u0007\u001b[?2004hgit push`);

      assert.deepEqual([(await result).outcome, process.writes], ["Input", []]);
      await fixture.endAllAsync();
    });

    it("tells the owner's windows of a new terminal before starting its shell, and starts the shell at its pane's size once the pane gives it, so a prompt longer than the opening 80 columns and the commands after it are drawn at the pane's width", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { result, sessionId, spawning } = await openNewAsync(fixture);
      await vi.waitFor(() => assert.equal(fixture.opened.published.length, 1));
      const spawnedBeforeFit: number = fixture.spawner.spawned.length;

      await fixture.host.handleAsync("terminal.resize", { sessionId, size: PANE_SIZE }, APP);
      const process: FakePtyProcess = await readAsync(spawning);
      const nonce: string = nonceOf(fixture, process);
      const prompt: string = `${"~/work/".repeat(13)}$ `;
      process.emitData(`\u001b]6973;A;${nonce}\u0007${prompt}\u001b]6973;B;${nonce}\u0007\u001b[?2004h`);

      assert.ok(prompt.length > 80);
      assert.deepEqual([(await result).outcome, spawnedBeforeFit, fixture.spawner.calls.at(-1)?.endsWith(" at 120x30"), process.sizes, process.writes],
        ["Typed", 0, true, [], ["\u001b[200~npm test\u001b[201~\r"]]);
      const [summary] = await fixture.listAsync();
      assert.deepEqual(fixture.opened.published, [{ sessionId, shellId: summary?.shellId, folder: summary?.folder, title: summary?.title,
        exit: null, isAgentTerminal: false, isPanelTerminal: false, owner: OWNER, opensTab: true, name: null, shellName: "bash", shellKind: "Bash" }]);
      await fixture.endAllAsync();
    });

    it("tells only the asking window of a new terminal a run without a tab opens, before starting its shell, marks it so for the owner's windows and in the list, and types once the attached pane's first fit starts the shell", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { result, sessionId, spawning } = await openNewAsync(fixture, { opensTab: false });
      await vi.waitFor(() => assert.equal(fixture.runOpened.published.length, 1));
      const spawnedWhenTold: number = fixture.spawner.spawned.length;

      await fixture.host.handleAsync("terminal.resize", { sessionId, size: PANE_SIZE }, APP);
      const process: FakePtyProcess = await readAsync(spawning);
      showPrompt(fixture, process);

      assert.deepEqual([(await result).outcome, spawnedWhenTold, fixture.spawner.calls.at(-1)?.endsWith(" at 120x30"), process.writes],
        ["Typed", 0, true, ["\u001b[200~npm test\u001b[201~\r"]]);
      assert.deepEqual([fixture.runOpened.published, fixture.runOpened.targets], [[{ sessionId }], ["1/1"]]);
      assert.deepEqual([fixture.opened.published.map(t => TerminalSummary.fromJson(t).opensTab), (await fixture.listAsync()).map(t => t.opensTab)],
        [[false], [false]]);
      await fixture.endAllAsync();
    });

    it("waits up to 10 seconds for the asking window's pane to fit a new terminal a run without a tab opens, though no window shows its owner, then starts it at its opening size and types into it", async () => {
      vi.useFakeTimers();
      const fixture: HostFixture = await HostFixture.createAsync();
      const { result, sessionId, spawning } = await openNewAsync(fixture, { opensTab: false }, false);

      await vi.advanceTimersByTimeAsync(9_999);
      const spawnedBeforeLimit: number = fixture.spawner.spawned.length;
      await vi.advanceTimersByTimeAsync(1);
      vi.useRealTimers();
      const process: FakePtyProcess = await readAsync(spawning);
      showPrompt(fixture, process);

      assert.deepEqual([spawnedBeforeLimit, fixture.runOpened.published, (await result).outcome, fixture.spawner.calls.at(-1)?.endsWith(" at 80x24"),
        process.writes], [0, [{ sessionId }], "Typed", true, ["\u001b[200~npm test\u001b[201~\r"]]);
      await fixture.endAllAsync();
    });

    it("starts a new terminal a run without a tab opens at its opening size once the asking window closes before its pane fits, and types into it", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { result, spawning } = await openNewAsync(fixture, { opensTab: false });
      const spawnedBeforeClose: number = fixture.spawner.spawned.length;

      await fixture.host.closeConnectionAsync(APP.connection, APP.window);
      const process: FakePtyProcess = await readAsync(spawning);
      showPrompt(fixture, process);

      assert.deepEqual([spawnedBeforeClose, (await result).outcome, fixture.spawner.calls.at(-1)?.endsWith(" at 80x24"), process.writes],
        [0, "Typed", true, ["\u001b[200~npm test\u001b[201~\r"]]);
      await fixture.endAllAsync();
    });

    it("types into a new terminal whose integration said it loaded at its first prompt, while the person's profile takes up to 60 seconds", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { result, spawning } = await openNewAsync(fixture, {}, false);
        const process: FakePtyProcess = await readAsync(spawning);
        const nonce: string = fixture.writer.nonceFor(fixture.spawner.environments[fixture.spawner.spawned.indexOf(process)]);
        process.emitData(`\u001b]6973;L;${nonce}\u0007`);

        await vi.advanceTimersByTimeAsync(59_999);
        const writtenBeforePrompt: readonly string[] = [...process.writes];
        vi.useRealTimers();
        showPrompt(fixture, process);

        assert.deepEqual([writtenBeforePrompt, (await result).outcome, process.writes], [[], "Typed", ["\u001b[200~npm test\u001b[201~\r"]]);
        await fixture.endAllAsync();
      }
      finally {
        vi.useRealTimers();
      }
    });

    it("starts a new terminal a run without a tab opens at once at its opening size while the asking window is hidden, as a minimized one is, and types into it", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      await fixture.host.handleAsync("terminal.showOwner", { owner: null, isHidden: true }, APP);
      const { result, spawning } = await openNewAsync(fixture, { opensTab: false }, false);
      const process: FakePtyProcess = await readAsync(spawning);
      showPrompt(fixture, process);

      assert.deepEqual([(await result).outcome, fixture.spawner.calls.at(-1)?.endsWith(" at 80x24"), process.writes], ["Typed", true, ["\u001b[200~npm test\u001b[201~\r"]]);
      await fixture.endAllAsync();
    });

    it("starts a new terminal a run without a tab opens once the asking window hides before its pane fits, but waits for the fit of a window shown again", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      await fixture.host.handleAsync("terminal.showOwner", { owner: null, isHidden: true }, APP);
      await fixture.host.handleAsync("terminal.showOwner", { owner: null, isHidden: false }, APP);
      const { result, spawning } = await openNewAsync(fixture, { opensTab: false }, false);
      await fixture.host.handleAsync("terminal.showOwner", { owner: OWNER }, APP);
      const spawnedWhileShown: number = fixture.spawner.spawned.length;

      await fixture.host.handleAsync("terminal.showOwner", { owner: null, isHidden: true }, APP);
      const process: FakePtyProcess = await readAsync(spawning);
      showPrompt(fixture, process);

      assert.deepEqual([spawnedWhileShown, (await result).outcome, fixture.spawner.calls.at(-1)?.endsWith(" at 80x24")], [0, "Typed", true]);
      await fixture.endAllAsync();
    });

    it("tells only the asking window of the free terminal a run without a tab types into, telling no window to open its tab, and keeps the terminal's own tab mark", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { sessionId, process: free } = await openFreeAsync(fixture);
      const opened: number = fixture.opened.published.length;

      const result: TerminalRunResult = await runAsync(fixture, { opensTab: false });

      assert.deepEqual([result.sessionId, result.outcome, free.writes], [sessionId, "Typed", ["\u001b[200~npm test\u001b[201~\r"]]);
      assert.deepEqual([fixture.runOpened.published, fixture.runOpened.targets, fixture.opened.published.length - opened], [[{ sessionId }], ["1/1"], 0]);
      assert.deepEqual((await fixture.listAsync()).map(t => t.opensTab), [true]);
      await fixture.endAllAsync();
    });

    it("keeps a terminal a run opened without a tab so for the next run, which opens it again without one", async () => {
      const last: HostFixture = await HostFixture.createAsync();
      const { result, process } = await startNewAsync(last, { opensTab: false });
      showPrompt(last, process);
      await result;
      await last.endAllAsync();
      const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", { SHELL: "/bin/bash" }, undefined, null, last.database);

      await fixture.host.handleAsync("terminal.restore", RESTORE, APP);

      assert.deepEqual([last.saved.list().map(t => t.opensTab), (await fixture.listAsync()).map(t => [t.owner, t.opensTab]),
        fixture.saved.list().map(t => t.opensTab)], [[false], [[OWNER, false]], [false]]);
      await fixture.endAllAsync();
    });

    it("tells no window of the terminal a run with a tab picks or opens", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      await openFreeAsync(fixture);
      const opened: number = fixture.opened.published.length;

      await runAsync(fixture);
      await runNewAsync(fixture);

      assert.deepEqual([fixture.runOpened.published, fixture.opened.published.slice(opened).map(t => TerminalSummary.fromJson(t).opensTab)], [[], [true]]);
      await fixture.endAllAsync();
    });

    it("starts a new terminal's shell at once at a first fit that keeps the opening size", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { result, sessionId, spawning } = await openNewAsync(fixture);

      await fixture.host.handleAsync("terminal.resize", { sessionId, size: SIZE }, APP);
      const process: FakePtyProcess = await readAsync(spawning);
      showPrompt(fixture, process);

      assert.deepEqual([(await result).outcome, fixture.spawner.calls.at(-1)?.endsWith(" at 80x24"), process.sizes], ["Typed", true, []]);
      await fixture.endAllAsync();
    });

    it("starts a new terminal's shell at once at its opening size when no window shows its owner, and types into it", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { result, spawning } = await openNewAsync(fixture, {}, false);
      const process: FakePtyProcess = await readAsync(spawning);
      showPrompt(fixture, process);

      assert.deepEqual([(await result).outcome, fixture.spawner.calls.at(-1)?.endsWith(" at 80x24"), process.writes],
        ["Typed", true, ["\u001b[200~npm test\u001b[201~\r"]]);
      await fixture.endAllAsync();
    });

    it("starts a new terminal's shell at once when only windows of connections that don't reach it show its owner", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      await fixture.host.handleAsync("terminal.showOwner", { owner: OWNER }, new RequestClient(3, 1, false));
      const { result, spawning } = await openNewAsync(fixture, {}, false);
      const process: FakePtyProcess = await readAsync(spawning);
      showPrompt(fixture, process);

      assert.deepEqual([(await result).outcome, fixture.spawner.calls.at(-1)?.endsWith(" at 80x24")], ["Typed", true]);
      await fixture.endAllAsync();
    });

    it("waits for the first fit while one of two windows shows the owner, the other another owner, and starts once it hides it", async () => {
      vi.useFakeTimers();
      const fixture: HostFixture = await HostFixture.createAsync();
      await fixture.host.handleAsync("terminal.showOwner", { owner: "example.chat/7" }, new RequestClient(1, 2, true));
      const { result, spawning } = await openNewAsync(fixture);
      await vi.advanceTimersByTimeAsync(9_999);
      const spawnedWhileShown: number = fixture.spawner.spawned.length;
      vi.useRealTimers();

      await fixture.host.handleAsync("terminal.showOwner", { owner: null }, APP);
      const process: FakePtyProcess = await readAsync(spawning);
      showPrompt(fixture, process);

      assert.deepEqual([spawnedWhileShown, (await result).outcome, fixture.spawner.calls.at(-1)?.endsWith(" at 80x24")], [0, "Typed", true]);
      await fixture.endAllAsync();
    });

    it("starts a new terminal's shell at its opening size 10 seconds into its wait for a pane that a window shows and never sizes, not before, and types into it", async () => {
      vi.useFakeTimers();
      const fixture: HostFixture = await HostFixture.createAsync();
      const { result, spawning } = await openNewAsync(fixture);
      await vi.advanceTimersByTimeAsync(9_999);
      const spawnedBeforeLimit: number = fixture.spawner.spawned.length;
      await vi.advanceTimersByTimeAsync(1);
      vi.useRealTimers();

      const process: FakePtyProcess = await readAsync(spawning);
      showPrompt(fixture, process);

      assert.deepEqual([spawnedBeforeLimit, fixture.spawner.spawned.length, (await result).outcome, fixture.spawner.calls.at(-1)?.endsWith(" at 80x24"),
        process.writes], [0, 1, "Typed", true, ["\u001b[200~npm test\u001b[201~\r"]]);
      await fixture.endAllAsync();
    });

    for (const [label, leave] of [
      ["shows another owner", (fixture: HostFixture): Promise<unknown> => fixture.host.handleAsync("terminal.showOwner", { owner: "example.chat/7" }, APP)],
      ["closes", (fixture: HostFixture): Promise<unknown> => fixture.host.closeConnectionAsync(APP.connection, APP.window)],
      ["disconnects", (fixture: HostFixture): Promise<unknown> => fixture.host.closeConnectionAsync(APP.connection, null)],
      ["detaches the terminal's pane", (fixture: HostFixture, sessionId: string): Promise<unknown> =>
        fixture.host.handleAsync("terminal.detach", { sessionId, paneId: "p1" }, APP)]
    ] as const)
      it(`starts a new terminal's shell at its opening size once the window that shows its owner ${label} before its pane fits`, async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, spawning } = await openNewAsync(fixture);
        const spawnedBefore: number = fixture.spawner.spawned.length;

        const leaving: Promise<unknown> = leave(fixture, sessionId);
        await readAsync(spawning);

        assert.deepEqual([spawnedBefore, fixture.spawner.spawned.length, fixture.spawner.calls.at(-1)?.endsWith(" at 80x24")], [0, 1, true]);
        await fixture.endAllAsync();
        await leaving;
      });

    it("starts a new terminal's shell once, at its first fit, though its window hides the owner and detaches the pane after", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { result, sessionId, spawning } = await openNewAsync(fixture);

      await fixture.host.handleAsync("terminal.resize", { sessionId, size: PANE_SIZE }, APP);
      await fixture.host.handleAsync("terminal.showOwner", { owner: null }, APP);
      await fixture.host.handleAsync("terminal.detach", { sessionId, paneId: "p1" }, APP);
      const process: FakePtyProcess = await readAsync(spawning);
      showPrompt(fixture, process);

      assert.deepEqual([(await result).outcome, fixture.spawner.spawned.length, fixture.spawner.calls.at(-1)?.endsWith(" at 120x30")], ["Typed", 1, true]);
      await fixture.endAllAsync();
    });

    it("resizes a new terminal's shell, started at once for an owner no window showed, at a pane's later first fit, and types into it", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { result, sessionId, spawning } = await openNewAsync(fixture, {}, false);
      const process: FakePtyProcess = await readAsync(spawning);

      await fixture.host.handleAsync("terminal.resize", { sessionId, size: PANE_SIZE }, APP);
      showPrompt(fixture, process);

      assert.deepEqual([(await result).outcome, fixture.spawner.calls.at(-1)?.endsWith(" at 80x24"), process.sizes, process.writes],
        ["Typed", true, ["120x30"], ["\u001b[200~npm test\u001b[201~\r"]]);
      await fixture.endAllAsync();
    });

    for (const [label, end] of [
      ["its pane closes", (fixture: HostFixture, sessionId: string): Promise<unknown> => fixture.host.handleAsync("terminal.close", { sessionId }, APP)],
      ["the host ends", (fixture: HostFixture): Promise<unknown> => fixture.host.endAllAsync()]
    ] as const)
      it(`answers Ended, starting no shell, once ${label} while a new terminal waits for its pane's first fit`, async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { result, sessionId } = await openNewAsync(fixture);

        await end(fixture, sessionId);

        assert.deepEqual([(await result).outcome, fixture.spawner.spawned.length], ["Ended", 0]);
        await fixture.endAllAsync();
      });

    it("answers Ended, typing nothing, once a new terminal's shell, started at its pane's first fit, exits before its prompt", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { result, process } = await startNewAsync(fixture);

      process.exit(0);

      assert.deepEqual([(await result).outcome, process.writes], ["Ended", []]);
      await fixture.endAllAsync();
    });

    for (const failure of [new Error("spawn failed"), "spawn failed"])
      it(`answers Ended, logging why, once a new terminal's shell can't start at its pane's first fit, throwing ${typeof failure === "string" ? "a string" : "an error"}`, async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { result, sessionId } = await openNewAsync(fixture);
        fixture.spawner.failure = failure;
        const removedBeforeFit: string[] = [...fixture.writer.removedFiles];

        await fixture.host.handleAsync("terminal.resize", { sessionId, size: PANE_SIZE }, APP);

        assert.deepEqual([(await result).outcome, fixture.log.messages.at(-1)], ["Ended",
          `The shell of terminal ${sessionId}, waiting for its pane's size, could not start: spawn failed`]);
        assert.deepEqual([removedBeforeFit, fixture.writer.removedFiles],
          [[], [...fixture.writer.files.keys()].filter(t => path.basename(t).startsWith("nonce-"))]);
        assert.equal(fixture.writer.removedFiles.length, 1);
        await fixture.endAllAsync();
      });

    it("drops what a new terminal's pane sends before its shell starts, counting only the person's keys as typing before its commands", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { result, sessionId, spawning } = await openNewAsync(fixture);

      await fixture.host.handleAsync("terminal.input", { sessionId, data: "\u001b[I" }, APP);
      await fixture.host.handleAsync("terminal.resize", { sessionId, size: PANE_SIZE }, APP);
      const process: FakePtyProcess = await readAsync(spawning);
      showPrompt(fixture, process);

      assert.deepEqual([(await result).outcome, process.writes], ["Typed", ["\u001b[200~npm test\u001b[201~\r"]]);
      await fixture.endAllAsync();
    });

    it("types nothing into a new terminal that closes before its prompt, answering Ended", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { result, sessionId, process } = await startNewAsync(fixture);

      await fixture.host.handleAsync("terminal.close", { sessionId }, APP);

      assert.deepEqual([(await result).outcome, process.writes], ["Ended", []]);
    });

    const silentEnds: readonly (readonly [string, (fixture: HostFixture, sessionId: string, process: FakePtyProcess) => Promise<unknown>])[] = [
      ["its shell exits", async (_fixture, _sessionId, process) => process.exit(0)],
      ["its terminal closes", (fixture, sessionId) => fixture.host.handleAsync("terminal.close", { sessionId }, APP)]
    ];
    for (const [ending, end] of silentEnds)
      it(`answers Ended at once, typing nothing, when ${ending} at 20 seconds while the run waits for a shell with the integration that has shown no text`, async () => {
        vi.useFakeTimers();
        const fixture: HostFixture = await HostFixture.createAsync();
        const { result, sessionId, process } = await startNewAsync(fixture);
        const outcomes: string[] = [];
        void result.then(t => outcomes.push(t.outcome));

        await vi.advanceTimersByTimeAsync(20_000);
        const whileWaiting: readonly string[] = [...outcomes];
        const ended: Promise<unknown> = end(fixture, sessionId, process);
        await vi.advanceTimersByTimeAsync(0);

        assert.deepEqual([whileWaiting, outcomes, process.writes], [[], ["Ended"], []]);
        vi.useRealTimers();
        await ended;
        await fixture.endAllAsync();
      });

    it("types each run into a new Command Prompt, which has no integration and is never free, once its output settles, and refuses commands holding a tab there", async () => {
      const fixture: HostFixture = await HostFixture.createAsync("win32", "10.0.26100", { SystemRoot: "C:\\Windows" });
      fixture.fileSystem.folders.add("C:\\work");
      const request: Record<string, JsonValue> = { folder: "C:\\work", shellKinds: ["CommandPrompt"], shellId: "cmd" };

      const { result: tabbed, process: first } = await startNewAsync(fixture, { ...request, command: "dir\t/b" });
      first.emitData("C:\\work>");
      const { result: typed, process: second } = await startNewAsync(fixture, { ...request, command: "dir\r\necho done" });
      second.emitData("C:\\work>");

      assert.deepEqual([(await tabbed).outcome, (await typed).outcome], ["Tab", "Typed"]);
      assert.deepEqual([first.writes, second.writes], [[], ["dir\recho done\r"]]);
      await fixture.endAllAsync();
    });

    const passedOver: ReadonlyArray<readonly [string, (fixture: HostFixture) => Promise<FakePtyProcess>, Record<string, JsonValue>]> = [
      ["one running a command", async fixture => {
        const { process } = await openFreeAsync(fixture);
        process.emitData(`make\r\n\u001b]6973;C;${nonceOf(fixture, process)}\u0007`);
        return process;
      }, {}],
      ["one with a line waiting at its prompt", async fixture => {
        const { process } = await openFreeAsync(fixture);
        process.emitData("rm -rf ");
        return process;
      }, {}],
      ["one the person typed into under a second ago", async fixture => {
        const { sessionId, process } = await openFreeAsync(fixture);
        await fixture.host.handleAsync("terminal.input", { sessionId, data: "l" }, APP);
        return process;
      }, {}],
      ["one without the shell integration", async fixture => {
        await fixture.openAsync(ownedOpen(OWNER));
        fixture.process.emitData("$ ");
        return fixture.process;
      }, {}],
      ["an agent's", async fixture => {
        await fixture.host.openTerminalAsync(null, "/work", new TerminalSize(80, 24), "agent-1", 104_857_600, null, false, OWNER);
        showPrompt(fixture, fixture.process);
        return fixture.process;
      }, {}],
      ["another kind's", async fixture => {
        fixture.fileSystem.files.set("/etc/shells", "/bin/bash\n/bin/zsh\n");
        fixture.fileSystem.files.set("/bin/zsh", "");
        return (await openFreeAsync(fixture)).process;
      }, { shellKinds: ["Zsh", "PowerShell"] }],
      ["an ended one", async fixture => {
        const { process } = await openFreeAsync(fixture);
        process.exit(0);
        return process;
      }, {}],
      ["another owner's", async fixture => (await openFreeAsync(fixture, "example.chat/7")).process, {}],
      ["one another connection opened", async fixture => {
        await fixture.host.handleAsync("terminal.open", ownedOpen(OWNER), COMMAND_LINE);
        showPrompt(fixture, fixture.process);
        return fixture.process;
      }, {}]
    ];
    for (const [name, setUpAsync, request] of passedOver)
      it(`passes over ${name} for a new terminal of the owner, which takes the commands once its shell is ready`, async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const passed: FakePtyProcess = await setUpAsync(fixture);
        const typed: readonly string[] = [...passed.writes];

        const { result, process: opened } = await startNewAsync(fixture, request);
        await vi.waitFor(() => assert.notEqual(fixture.host.terminals.at(-1)?.pendingCommand ?? null, null));
        const beforePrompt: readonly string[] = [...opened.writes];
        showPrompt(fixture, opened);
        const { sessionId, outcome } = await result;

        assert.deepEqual(opened.writes, ["\u001b[200~npm test\u001b[201~\r"]);
        assert.notEqual(opened, passed);
        assert.deepEqual([outcome, beforePrompt, passed.writes], ["Typed", [], typed]);
        assert.deepEqual((await fixture.listAsync()).filter(t => t.sessionId === sessionId).map(t => [t.owner, t.folder, t.isAgentTerminal]),
          [[OWNER, "/work", false]]);
        await fixture.endAllAsync();
      });

    it("counts a run's typing as the person's keys, so a second run under a second later opens another terminal", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { sessionId: freeId, process: free } = await openFreeAsync(fixture);

      const first: TerminalRunResult = await runAsync(fixture);
      const second: TerminalRunResult = await runNewAsync(fixture, { command: "npm run lint" });

      assert.deepEqual(free.writes, ["\u001b[200~npm test\u001b[201~\r"]);
      assert.deepEqual([first.sessionId, second.sessionId !== freeId, second.outcome, fixture.spawner.spawned.length], [freeId, true, "Typed", 2]);
      await fixture.endAllAsync();
    });

    it("opens a new terminal with the default shell when it is of the kinds or none are given, else the first installed shell of the kinds", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      fixture.fileSystem.files.set("/etc/shells", "/bin/bash\n/bin/zsh\n/usr/bin/fish\n");
      fixture.fileSystem.files.set("/bin/zsh", "");
      fixture.fileSystem.files.set("/usr/bin/fish", "");

      for (const request of [{ shellKinds: ["Zsh", "Fish"] }, { shellKinds: ["Fish"], shellId: "zsh" }, { shellKinds: ["Bash", "Zsh"], shellId: "zsh" },
        { shellKinds: [] }, { shellKinds: [], shellId: "zsh" }, { shellKinds: [], shellId: "gone" }])
        await runNewAsync(fixture, request);

      assert.deepEqual(fixture.spawner.calls.map(t => t.split(" ")[0]), ["/bin/zsh", "/usr/bin/fish", "/bin/zsh", "/bin/bash", "/bin/zsh", "/bin/bash"]);
      await fixture.endAllAsync();
    });

    it("answers that no shell of the kinds is installed, opening nothing and typing into no terminal, not even the default shell's free one", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { sessionId: freeId, process: free } = await openFreeAsync(fixture);
      const typed: readonly string[] = [...free.writes];

      for (const request of [{ shellKinds: ["PowerShell"] }, { shellKinds: ["CommandPrompt", "Fish"], shellId: "bash" }, { shellKinds: ["Zsh"], shellId: "gone" }])
        assert.deepEqual((await runAsync(fixture, request)).toJson(), { sessionId: null, outcome: "NoShell", runId: null, endedRuns: [] });

      assert.equal(fixture.spawner.spawned.length, 1);
      assert.deepEqual(free.writes, typed);
      assert.deepEqual((await fixture.listAsync()).map(t => t.sessionId), [freeId]);
      assert.equal(fixture.log.messages.some(t => t.includes("npm test")), false);
      await fixture.endAllAsync();
    });

    it("refuses as no default shell found when no shell is installed and the run takes any, and answers no shell when it takes some", async () => {
      const fixture: HostFixture = await HostFixture.createAsync("linux", "6.8.0", {});

      await assert.rejects(runAsync(fixture, { shellKinds: [] }),
        (error: unknown) => error instanceof DefaultShellNotFoundException && error.message === "No default shell was found.");
      assert.deepEqual((await runAsync(fixture, { shellKinds: ["Bash"] })).toJson(), { sessionId: null, outcome: "NoShell", runId: null, endedRuns: [] });

      assert.equal(fixture.spawner.spawned.length, 0);
    });

    it("opens a new terminal in the home folder for no folder, and for one that no longer exists, which the log says", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      fixture.fileSystem.folders.add("/home/a");

      await runNewAsync(fixture, { folder: null });
      await runNewAsync(fixture, { folder: "/gone" });

      assert.deepEqual(fixture.spawner.calls.map(t => t.split(" in ")[1]), ["/home/a at 120x30", "/home/a at 120x30"]);
      assert.equal(fixture.log.messages.filter(t => t.includes("/gone")).length, 1);
      await fixture.endAllAsync();
    });

    it("refuses a blank owner, blank commands, a control character other than a line break or a tab, a format or default-ignorable character, a relative folder or an unknown kind, typing and opening nothing", async () => {
      const fixture: HostFixture = await HostFixture.createAsync();
      const { process: free } = await openFreeAsync(fixture);

      for (const request of [{ owner: " " }, { command: " \n " }, { command: "ls\u001b[A" }, { command: "ls\rzap" }, { command: "ls # \u202ezap" },
        { command: "ls\u200bzap" }, { command: "ls\u{e0041}zap" }, { command: "ls\u034fzap" }, { folder: "work" }, { shellKinds: ["Csh"] }])
        await assert.rejects(fixture.host.handleAsync("terminal.run", { ...run, ...request }, APP),
          (error: unknown) => error instanceof JsonException && !error.message.includes("zap"));

      assert.deepEqual([free.writes, fixture.spawner.spawned.length], [[], 1]);
      await fixture.endAllAsync();
    });

    describe("into a terminal it names", () => {
      const GONE: string = "00000000-0000-4000-8000-000000000000";
      const PASTE: string = "\u001b[200~npm test\u001b[201~\r";

      function mark(fixture: HostFixture, process: FakePtyProcess, kind: string, value: string | null = null): string {
        return `\u001b]6973;${kind};${nonceOf(fixture, process)}${value === null ? "" : `;${value}`}\u0007`;
      }

      function prompt(fixture: HostFixture, process: FakePtyProcess): string {
        return `${mark(fixture, process, "A")}$ ${mark(fixture, process, "B")}\u001b[?2004h`;
      }

      function command(fixture: HostFixture, process: FakePtyProcess, line: string, output: string): string {
        return `${line}\r\n${mark(fixture, process, "C")}${output}${mark(fixture, process, "D", "0")}${prompt(fixture, process)}`;
      }

      function plain(text: string): JsonValue {
        return { text, wrapped: false, runs: text.length === 0 ? [] : [{ length: text.length, foreground: -1, background: -1, style: 0 }] };
      }

      function runOutputAsync(fixture: HostFixture, sessionId: string, runId: string | null, maximumLines: number = 100,
        client: RequestClient = APP): Promise<JsonValue> {
        return fixture.host.handleAsync("terminal.runOutput", { sessionId, runId: runId ?? "", maximumLines }, client);
      }

      function settle(): void {
        vi.setSystemTime(Date.now() + 1_000);
      }

      it("types into the named terminal of the owner though a newer one is free, and answers Typed with the run's id", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process: named } = await openFreeAsync(fixture);
        const { process: newest } = await openFreeAsync(fixture);

        const result: TerminalRunResult = await runAsync(fixture, { sessionId, shellKinds: ["Bash"], whenBusy: "Interrupt", opensTab: true });

        assert.deepEqual([result.sessionId, result.outcome, named.writes, newest.writes], [sessionId, "Typed", [PASTE], []]);
        assert.match(result.runId ?? "", /^[\da-f-]{36}$/u);
        await fixture.endAllAsync();
      });

      const unreached: ReadonlyArray<readonly [string, (fixture: HostFixture) => Promise<string>, Record<string, JsonValue>]> = [
        ["a terminal the runtime doesn't have", async () => GONE, {}],
        ["another owner's terminal", async fixture => (await openFreeAsync(fixture, "example.chat/7")).sessionId, {}],
        ["an agent's terminal of the owner", async fixture => {
          const sessionId: string = (await fixture.host.openTerminalAsync(null, "/work", new TerminalSize(80, 24), "agent-1", 104_857_600, null, false,
            OWNER)).session.sessionId;
          showPrompt(fixture, fixture.process);
          return sessionId;
        }, {}],
        ["a terminal of another kind", async fixture => (await openFreeAsync(fixture)).sessionId, { shellKinds: ["Zsh"] }],
        ["a terminal another connection opened", async fixture => {
          const sessionId: string = TerminalReference.fromJson(await fixture.host.handleAsync("terminal.open", ownedOpen(OWNER), COMMAND_LINE)).sessionId;
          showPrompt(fixture, fixture.process);
          return sessionId;
        }, {}]
      ];
      for (const [name, setUpAsync, request] of unreached)
        it(`answers Ended for ${name}, alike, typing into and opening nothing`, async () => {
          const fixture: HostFixture = await HostFixture.createAsync();
          const sessionId: string = await setUpAsync(fixture);
          const spawned: number = fixture.spawner.spawned.length;

          const result: TerminalRunResult = await runAsync(fixture, { ...request, sessionId, whenBusy: "Interrupt", opensTab: true });

          assert.deepEqual(result.toJson(), { sessionId, outcome: "Ended", runId: null, endedRuns: [] });
          assert.deepEqual([fixture.spawner.spawned.length, fixture.spawner.spawned.flatMap(t => t.writes)], [spawned, []]);
          await fixture.endAllAsync();
        });

      const busy: ReadonlyArray<readonly [string, (fixture: HostFixture) => Promise<OpenedTerminal>]> = [
        ["running a command", async fixture => {
          const { sessionId, process } = await openFreeAsync(fixture);
          process.emitData(`make\r\n${mark(fixture, process, "C")}`);
          return new OpenedTerminal(sessionId, process);
        }],
        ["with a line waiting at its prompt", async fixture => {
          const { sessionId, process } = await openFreeAsync(fixture);
          process.emitData("rm -rf ");
          return new OpenedTerminal(sessionId, process);
        }],
        ["without the shell integration's marks", async fixture => {
          const sessionId: string = await fixture.openAsync(ownedOpen(OWNER));
          fixture.process.emitData("$ ");
          return new OpenedTerminal(sessionId, fixture.process);
        }]
      ];
      for (const [name, setUpAsync] of busy)
        it(`answers Busy for a run that refuses its terminal ${name}, typing nothing`, async () => {
          const fixture: HostFixture = await HostFixture.createAsync();
          const { sessionId, process } = await setUpAsync(fixture);

          const result: TerminalRunResult = await runAsync(fixture, { sessionId, whenBusy: "Refuse", opensTab: true });

          assert.deepEqual([result.toJson(), process.writes, fixture.spawner.spawned.length], [{ sessionId, outcome: "Busy", runId: null, endedRuns: [] }, [], 1]);
          await fixture.endAllAsync();
        });

      for (const whenBusy of ["Refuse", "Interrupt"] as const) {
        const as: string = whenBusy === "Refuse" ? "refuses" : "interrupts";

        it(`types into its terminal after a window's focus report, as a run that ${as} it, sending no Ctrl+C`, async () => {
          const fixture: HostFixture = await HostFixture.createAsync();
          const { sessionId, process } = await openFreeAsync(fixture);
          vi.useFakeTimers({ toFake: ["Date"] });
          await fixture.host.handleAsync("terminal.input", { sessionId, data: "\u001b[O" }, APP);

          const { outcome } = await runAsync(fixture, { sessionId, whenBusy, opensTab: true });
          vi.useRealTimers();

          assert.deepEqual([outcome, process.writes], ["Typed", ["\u001b[O", PASTE]]);
          await fixture.endAllAsync();
        });

        const keyed = [["a key", ["l"]], ["a focus report and then a key", ["\u001b[O", "l"]], ["a key and then a focus report", ["l", "\u001b[O"]]] as const;
        for (const [name, inputs] of keyed)
          it(`answers Busy for its terminal after ${name}, as a run that ${as} it, sending no Ctrl+C`, async () => {
            const fixture: HostFixture = await HostFixture.createAsync();
            const { sessionId, process } = await openFreeAsync(fixture);
            vi.useFakeTimers();
            for (const data of inputs)
              await fixture.host.handleAsync("terminal.input", { sessionId, data }, APP);

            const result: Promise<TerminalRunResult> = runAsync(fixture, { sessionId, whenBusy, opensTab: true });
            await vi.advanceTimersByTimeAsync(0);
            process.emitData("l");
            await vi.advanceTimersByTimeAsync(2_000);
            vi.useRealTimers();

            assert.deepEqual([(await result).toJson(), process.writes], [{ sessionId, outcome: "Busy", runId: null, endedRuns: [] }, inputs]);
            await fixture.endAllAsync();
          });
      }

      it("types at once after the person's command ended at its prompt, into its terminal or the free one it finds, and is busy for a key the shell never answers only for the settle", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        await fixture.host.handleAsync("terminal.input", { sessionId, data: "ls\r" }, APP);
        process.emitData(command(fixture, process, "ls", "file\r\n"));

        const named: TerminalRunResult = await runAsync(fixture, { sessionId });
        process.emitData(command(fixture, process, "npm test", "ok\r\n"));
        await fixture.host.handleAsync("terminal.input", { sessionId, data: "pwd\r" }, APP);
        process.emitData(command(fixture, process, "pwd", "/work\r\n"));
        const found: TerminalRunResult = await runAsync(fixture);
        process.emitData(command(fixture, process, "npm test", "ok\r\n"));
        await fixture.host.handleAsync("terminal.input", { sessionId, data: "\u0018" }, APP);
        const swallowed: TerminalRunResult = await runAsync(fixture, { sessionId });
        settle();
        const settled: TerminalRunResult = await runAsync(fixture, { sessionId });
        process.emitData(command(fixture, process, "npm test", "ok\r\n"));

        assert.deepEqual([named.outcome, found.sessionId, found.outcome, swallowed.outcome, settled.outcome], ["Typed", sessionId, "Typed", "Busy", "Typed"]);
        assert.deepEqual([process.writes, fixture.spawner.spawned.length], [["ls\r", PASTE, "pwd\r", PASTE, "\u0018", PASTE], 1]);
        await fixture.endAllAsync();
      });

      it("answers Busy for a key typed at the prompt that the shell then draws again, before the key's echo", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        await fixture.host.handleAsync("terminal.input", { sessionId, data: "l" }, APP);
        process.emitData(`\r\n${mark(fixture, process, "A")}$ ${mark(fixture, process, "B")}`);

        const result: TerminalRunResult = await runAsync(fixture, { sessionId });

        assert.deepEqual([result.outcome, process.writes], ["Busy", ["l"]]);
        await fixture.endAllAsync();
      });

      it("answers Busy for a key typed at the prompt that the shell then draws changed, with no command started or ended, before the key's echo", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        await fixture.host.handleAsync("terminal.input", { sessionId, data: "l" }, APP);
        process.emitData(`\r\n${mark(fixture, process, "A")}(main) $ ${mark(fixture, process, "B")}`);

        const result: TerminalRunResult = await runAsync(fixture, { sessionId });

        assert.deepEqual([result.outcome, process.writes], ["Busy", ["l"]]);
        await fixture.endAllAsync();
      });

      for (const whenBusy of ["Refuse", "Interrupt"] as const)
        it(`answers Busy for keys typed while a command ran, at the next prompt before their echo, as a run that ${whenBusy === "Refuse" ? "refuses" : "interrupts"} it, sending no Ctrl+C`, async () => {
          const fixture: HostFixture = await HostFixture.createAsync();
          const { sessionId, process } = await openFreeAsync(fixture);
          process.emitData(`make\r\n${mark(fixture, process, "C")}`);
          vi.useFakeTimers();
          await fixture.host.handleAsync("terminal.input", { sessionId, data: "git sta" }, APP);
          process.emitData(`${mark(fixture, process, "D", "0")}${prompt(fixture, process)}`);

          const result: Promise<TerminalRunResult> = runAsync(fixture, { sessionId, whenBusy });
          await vi.advanceTimersByTimeAsync(0);
          process.emitData("git sta");
          await vi.advanceTimersByTimeAsync(2_000);
          vi.useRealTimers();

          assert.deepEqual([(await result).toJson(), process.writes], [{ sessionId, outcome: "Busy", runId: null, endedRuns: [] }, ["git sta"]]);
          await fixture.endAllAsync();
        });

      for (const inputs of [["make\r", "git sta"], ["make\rgit sta"]])
        for (const whenBusy of ["Refuse", "Interrupt"] as const)
          it(`answers Busy for keys ${inputs.length === 1 ? "pasted after a line break" : "typed after Enter before the command started"}, at the next prompt before their echo, as a run that ${whenBusy === "Refuse" ? "refuses" : "interrupts"} it, sending no Ctrl+C`, async () => {
            const fixture: HostFixture = await HostFixture.createAsync();
            const { sessionId, process } = await openFreeAsync(fixture);
            vi.useFakeTimers();
            for (const data of inputs)
              await fixture.host.handleAsync("terminal.input", { sessionId, data }, APP);
            process.emitData(`make\r\n${mark(fixture, process, "C")}${mark(fixture, process, "D", "0")}${prompt(fixture, process)}`);

            const result: Promise<TerminalRunResult> = runAsync(fixture, { sessionId, whenBusy });
            await vi.advanceTimersByTimeAsync(0);
            process.emitData("git sta");
            await vi.advanceTimersByTimeAsync(2_000);
            vi.useRealTimers();

            assert.deepEqual([(await result).toJson(), process.writes], [{ sessionId, outcome: "Busy", runId: null, endedRuns: [] }, inputs]);
            await fixture.endAllAsync();
          });

      it("answers Ended for its terminal whose shell ended, typing nothing", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        process.exit(0);

        const result: TerminalRunResult = await runAsync(fixture, { sessionId, whenBusy: "Interrupt", opensTab: true });

        assert.deepEqual([result.toJson(), process.writes], [{ sessionId, outcome: "Ended", runId: null, endedRuns: [] }, []]);
        await fixture.endAllAsync();
      });

      it("interrupts its busy terminal with Ctrl+C, then types once the shell is back at an empty prompt", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        process.emitData(`make\r\n${mark(fixture, process, "C")}`);

        const result: Promise<TerminalRunResult> = runAsync(fixture, { sessionId, whenBusy: "Interrupt", opensTab: true });
        await vi.waitFor(() => assert.deepEqual(process.writes, ["\u0003"]));
        process.emitData(`^C\r\n${mark(fixture, process, "D", "130")}${prompt(fixture, process)}`);
        const { outcome, runId } = await result;

        assert.deepEqual([outcome, process.writes], ["Typed", ["\u0003", PASTE]]);
        assert.match(runId ?? "", /^[\da-f-]{36}$/u);
        await fixture.endAllAsync();
      });

      it("sends Ctrl+C to the command a run typed only once the shell started it, as a shell still reading the line loses it", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        await runAsync(fixture, { sessionId });
        process.emitData("npm test");
        vi.useFakeTimers();

        const result: Promise<TerminalRunResult> = runAsync(fixture, { sessionId, whenBusy: "Interrupt", opensTab: true });
        await vi.advanceTimersByTimeAsync(1_500);
        const unstarted: readonly string[] = [...process.writes];
        process.emitData(`\r\n${mark(fixture, process, "C")}`);
        await vi.advanceTimersByTimeAsync(0);
        const started: readonly string[] = [...process.writes];
        vi.useRealTimers();
        process.emitData(`^C\r\n${mark(fixture, process, "D", "130")}${prompt(fixture, process)}`);

        assert.deepEqual([unstarted, started, (await result).outcome, process.writes], [[PASTE], [PASTE, "\u0003"], "Typed", [PASTE, "\u0003", PASTE]]);
        await fixture.endAllAsync();
      });

      it("sends Ctrl+C only once the started command, not the shell, holds the terminal, as zsh and bash mark a start before they start it",
        async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        process.foregroundProcessGroup = process.pid;
        process.emitData(`make\r\n${mark(fixture, process, "C")}`);
        vi.useFakeTimers();

        const result: Promise<TerminalRunResult> = runAsync(fixture, { sessionId, whenBusy: "Interrupt", opensTab: true });
        await vi.advanceTimersByTimeAsync(1_500);
        const heldByShell: readonly string[] = [...process.writes];
        process.foregroundProcessGroup = 5_000;
        await vi.advanceTimersByTimeAsync(50);
        const heldByCommand: readonly string[] = [...process.writes];
        vi.useRealTimers();
        process.emitData(`^C\r\n${mark(fixture, process, "D", "130")}${prompt(fixture, process)}`);

        assert.deepEqual([heldByShell, heldByCommand, (await result).outcome, process.writes], [[], ["\u0003"], "Typed", ["\u0003", PASTE]]);
        await fixture.endAllAsync();
      });

      it("sends no Ctrl+C to a command that ends while the shell still holds the terminal, and types once the shell is free", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        process.foregroundProcessGroup = process.pid;
        process.emitData(`make\r\n${mark(fixture, process, "C")}`);
        vi.useFakeTimers();

        const result: Promise<TerminalRunResult> = runAsync(fixture, { sessionId, whenBusy: "Interrupt", opensTab: true });
        await vi.advanceTimersByTimeAsync(500);
        const whileHeld: readonly string[] = [...process.writes];
        process.emitData(`\r\n${mark(fixture, process, "D", "0")}${prompt(fixture, process)}`);
        await vi.advanceTimersByTimeAsync(0);
        vi.useRealTimers();

        assert.deepEqual([whileHeld, (await result).outcome, process.writes], [[], "Typed", [PASTE]]);
        await fixture.endAllAsync();
      });

      it("answers Busy, sending no Ctrl+C, when the shell still holds the terminal 2 seconds after its command's start mark", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        process.foregroundProcessGroup = process.pid;
        process.emitData(`make\r\n${mark(fixture, process, "C")}`);
        vi.useFakeTimers();

        const result: Promise<TerminalRunResult> = runAsync(fixture, { sessionId, whenBusy: "Interrupt", opensTab: true });
        await vi.advanceTimersByTimeAsync(2_000);

        assert.deepEqual([(await result).toJson(), process.writes], [{ sessionId, outcome: "Busy", runId: null, endedRuns: [] }, []]);
        vi.useRealTimers();
        await fixture.endAllAsync();
      });

      it("answers Busy, sending no Ctrl+C, when the line at its terminal's prompt doesn't start within 2 seconds", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        process.emitData("rm -rf ");
        vi.useFakeTimers();

        const result: Promise<TerminalRunResult> = runAsync(fixture, { sessionId, whenBusy: "Interrupt", opensTab: true });
        await vi.advanceTimersByTimeAsync(2_000);

        assert.deepEqual([(await result).toJson(), process.writes], [{ sessionId, outcome: "Busy", runId: null, endedRuns: [] }, []]);
        vi.useRealTimers();
        await fixture.endAllAsync();
      });

      it("stops waiting to interrupt its terminal once the terminal restarts, answering Ended before its 2 seconds are up", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        process.emitData("rm -rf ");
        vi.useFakeTimers();

        let isAnswered: boolean = false;
        const result: Promise<TerminalRunResult> = runAsync(fixture, { sessionId, whenBusy: "Interrupt", opensTab: true }).finally(() => {
          isAnswered = true;
        });
        await vi.advanceTimersByTimeAsync(0);
        const restarting: Promise<JsonValue> = fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP);
        await vi.advanceTimersByTimeAsync(0);
        await restarting;
        await vi.advanceTimersByTimeAsync(0);
        const isAnsweredEarly: boolean = isAnswered;
        await vi.advanceTimersByTimeAsync(2_000);
        vi.useRealTimers();

        assert.deepEqual([isAnsweredEarly, (await result).toJson(), process.writes], [true, { sessionId, outcome: "Ended", runId: null, endedRuns: [] }, []]);
        await fixture.endAllAsync();
      });

      it("answers Busy, having typed only the Ctrl+C, when its interrupted shell isn't back at an empty prompt within 2 seconds", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        process.emitData(`make\r\n${mark(fixture, process, "C")}`);
        vi.useFakeTimers();

        let isAnswered: boolean = false;
        const result: Promise<TerminalRunResult> = runAsync(fixture, { sessionId, whenBusy: "Interrupt", opensTab: true }).finally(() => {
          isAnswered = true;
        });
        await vi.advanceTimersByTimeAsync(0);
        const interrupted: readonly string[] = [...process.writes];
        await vi.advanceTimersByTimeAsync(1_999);
        const isAnsweredEarly: boolean = isAnswered;
        await vi.advanceTimersByTimeAsync(1);

        assert.deepEqual([interrupted, isAnsweredEarly], [["\u0003"], false]);
        assert.deepEqual([(await result).toJson(), process.writes], [{ sessionId, outcome: "Busy", runId: null, endedRuns: [] }, ["\u0003"]]);
        vi.useRealTimers();
        await fixture.endAllAsync();
      });

      it("answers Busy for an interrupting run into a terminal that a run without a target is still typing into, sending no Ctrl+C", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { result: untargeted, process } = await startNewAsync(fixture);
        const sessionId: string = (await fixture.listAsync()).at(-1)?.sessionId ?? "";

        const result: TerminalRunResult = await runAsync(fixture, { sessionId, whenBusy: "Interrupt", opensTab: true });
        showPrompt(fixture, process);

        assert.deepEqual([result.toJson(), (await untargeted).outcome, process.writes], [{ sessionId, outcome: "Busy", runId: null, endedRuns: [] }, "Typed", [PASTE]]);
        await fixture.endAllAsync();
      });

      it("answers Busy for a second run into the terminal while the first is starting, typing only the first", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);

        const [first, second] = await Promise.all([runAsync(fixture, { sessionId }), runAsync(fixture, { sessionId, command: "npm run lint" })]);

        assert.deepEqual([first.outcome, second.toJson(), process.writes], ["Typed", { sessionId, outcome: "Busy", runId: null, endedRuns: [] }, [PASTE]]);
        await fixture.endAllAsync();
      });

      it("gives a run's lines with their colors from its prompt's line up to the next run's, with the person's own command between, and the latest run's up to the cursor's line", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);

        const first: TerminalRunResult = await runAsync(fixture, { sessionId });
        process.emitData(command(fixture, process, "npm test", "\u001b[31mok\u001b[0m\r\n"));
        await fixture.host.handleAsync("terminal.input", { sessionId, data: "ls\r" }, APP);
        process.emitData(command(fixture, process, "ls", "file\r\n"));
        const second: TerminalRunResult = await runAsync(fixture, { sessionId, command: "pwd" });
        process.emitData(command(fixture, process, "pwd", "/work\r\n"));

        assert.deepEqual([first.outcome, second.outcome], ["Typed", "Typed"]);
        assert.deepEqual(await runOutputAsync(fixture, sessionId, first.runId), {
          lines: [plain("$ npm test"), { text: "ok", wrapped: false, runs: [{ length: 2, foreground: 1, background: -1, style: 0 }] }, plain("$ ls"),
            plain("file")],
          cutLines: 0
        });
        assert.deepEqual(await runOutputAsync(fixture, sessionId, second.runId), { lines: [plain("$ pwd"), plain("/work"), plain("$")], cutLines: 0 });
        await fixture.endAllAsync();
      });

      it("keeps each run's lines its own when the pane narrows between the runs and widens before the read, reflowing a long line above them", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        await fixture.host.handleAsync("terminal.input", { sessionId, data: "cat long\r" }, APP);
        process.emitData(command(fixture, process, "cat long", `${"y".repeat(100)}\r\n`));

        const first: TerminalRunResult = await runAsync(fixture, { sessionId });
        process.emitData(command(fixture, process, "npm test", "ok\r\n"));
        await fixture.host.handleAsync("terminal.resize", { sessionId, size: { cols: 40, rows: 24 } }, APP);
        const second: TerminalRunResult = await runAsync(fixture, { sessionId, command: "pwd" });
        process.emitData(command(fixture, process, "pwd", "/work\r\n"));
        const narrower: JsonValue[] = [await runOutputAsync(fixture, sessionId, first.runId), await runOutputAsync(fixture, sessionId, second.runId)];
        await fixture.host.handleAsync("terminal.resize", { sessionId, size: { cols: 120, rows: 24 } }, APP);
        const wider: JsonValue[] = [await runOutputAsync(fixture, sessionId, first.runId), await runOutputAsync(fixture, sessionId, second.runId)];

        const expected: JsonValue[] = [
          { lines: [plain("$ npm test"), plain("ok")], cutLines: 0 },
          { lines: [plain("$ pwd"), plain("/work"), plain("$")], cutLines: 0 }
        ];
        assert.deepEqual([narrower, wider], [expected, expected]);
        await fixture.endAllAsync();
      });

      it("gives a run's last lines up to the limit asked, with how many before them it cut", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);

        const { runId } = await runAsync(fixture, { sessionId });
        process.emitData(command(fixture, process, "npm test", "a\r\nb\r\nc\r\n"));

        assert.deepEqual(await runOutputAsync(fixture, sessionId, runId, 2), { lines: [plain("c"), plain("$")], cutLines: 3 });
        await fixture.endAllAsync();
      });

      it("starts a run typed before the shell's first prompt mark at the cursor's line", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const sessionId: string = await fixture.openAsync(ownedOpen(OWNER));
        const process: FakePtyProcess = fixture.process;
        process.emitData(`welcome\r\n$ ${mark(fixture, process, "B")}\u001b[?2004h`);

        const { runId } = await runAsync(fixture, { sessionId });
        process.emitData("npm test\r\nok\r\n");

        assert.deepEqual(await runOutputAsync(fixture, sessionId, runId), { lines: [plain("$ npm test"), plain("ok"), plain("")], cutLines: 0 });
        await fixture.endAllAsync();
      });

      it("answers no output for a run the terminal never had, one of another terminal, a client other than the app, an agent's terminal or a terminal the runtime doesn't have", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId: otherId } = await openFreeAsync(fixture);
        const { sessionId } = await openFreeAsync(fixture);
        const agentId: string = (await fixture.host.openTerminalAsync(null, "/work", new TerminalSize(80, 24), "agent-1", 104_857_600, null, false, OWNER))
          .session.sessionId;
        const { runId } = await runAsync(fixture, { sessionId });

        const answers: JsonValue[] = [
          await runOutputAsync(fixture, sessionId, GONE),
          await runOutputAsync(fixture, otherId, runId),
          await runOutputAsync(fixture, sessionId, runId, 100, COMMAND_LINE),
          await runOutputAsync(fixture, agentId, runId),
          await runOutputAsync(fixture, GONE, runId)
        ];

        assert.deepEqual(answers, [null, null, null, null, null]);
        assert.deepEqual(await runOutputAsync(fixture, sessionId, runId), { lines: [plain("$")], cutLines: 0 });
        await fixture.endAllAsync();
      });

      it("answers no output for a run whose terminal's shell ended", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        const { runId } = await runAsync(fixture, { sessionId });

        process.exit(0);
        await vi.waitFor(() => assert.equal(fixture.exited.published.length, 1));

        assert.equal(await runOutputAsync(fixture, sessionId, runId), null);
        await fixture.endAllAsync();
      });

      it("answers no output for a run while its terminal restarts, nor once it has restarted", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        fixture.spawner.isEndable = false;
        const { sessionId } = await openFreeAsync(fixture);
        const { runId } = await runAsync(fixture, { sessionId });
        const started: PromiseWithResolvers<void> = Promise.withResolvers<void>();
        fixture.spawner.hold = started.promise;

        const restarting: Promise<JsonValue> = fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP);
        await fixture.spawner.held.promise;
        const during: JsonValue = await runOutputAsync(fixture, sessionId, runId);
        fixture.spawner.isEndable = true;
        started.resolve();
        await restarting;

        assert.deepEqual([during, await runOutputAsync(fixture, sessionId, runId)], [null, null]);
        await fixture.endAllAsync();
      });

      it("tells only the window that asked that the run ended, at its command's end mark, with its code", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        const result: TerminalRunResult = await runAsync(fixture, { sessionId });

        process.emitData(`npm test\r\n${mark(fixture, process, "C")}failed\r\n`);
        const whileRunning: readonly JsonValue[] = [...fixture.runEnded.published];
        process.emitData(`${mark(fixture, process, "D", "3")}${prompt(fixture, process)}`);

        assert.deepEqual([result.endedRuns, whileRunning], [[], []]);
        assert.deepEqual([fixture.runEnded.published, fixture.runEnded.targets],
          [[{ sessionId, runId: result.runId, endedBy: "Command", exitCode: 3 }], ["1/1"]]);
        await fixture.endAllAsync();
      });

      it("ends a run of several lines, in a shell that takes no bracketed paste, with its last line, which a prompt on a new line ends too", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const sessionId: string = await fixture.openAsync(ownedOpen(OWNER));
        const process: FakePtyProcess = fixture.process;
        showPrompt(fixture, process, false);
        const result: TerminalRunResult = await runAsync(fixture, { sessionId, command: "make\n(exit 3)" });
        const plainPrompt: string = `${mark(fixture, process, "A")}$ ${mark(fixture, process, "B")}`;

        process.emitData(`make\r\n${mark(fixture, process, "C")}${mark(fixture, process, "D", "2")}${plainPrompt}`);
        const afterFirst: readonly JsonValue[] = [...fixture.runEnded.published];
        process.emitData(`(exit 3)\r\n${plainPrompt}`);

        assert.deepEqual([process.writes, afterFirst], [["make\r(exit 3)\r"], []]);
        assert.deepEqual(fixture.runEnded.published, [{ sessionId, runId: result.runId, endedBy: "Command", exitCode: null }]);
        await fixture.endAllAsync();
      });

      it("ends a pasted run of several lines at its command's end, not at the prompt bash draws again over the paste as it takes it", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        const result: TerminalRunResult = await runAsync(fixture, { sessionId, command: "true\n(exit 4)" });
        const plainPrompt: string = `${mark(fixture, process, "A")}$ ${mark(fixture, process, "B")}`;

        process.emitData(`true\r\n\r\n(exit 4)\u001b[A\r${plainPrompt}true\r\n\r\n(exit 4)\r\n`);
        const afterRedraw: readonly JsonValue[] = [...fixture.runEnded.published];
        process.emitData(`${mark(fixture, process, "C")}${mark(fixture, process, "D", "4")}${plainPrompt}`);

        assert.deepEqual(afterRedraw, []);
        assert.deepEqual(fixture.runEnded.published, [{ sessionId, runId: result.runId, endedBy: "Command", exitCode: 4 }]);
        await fixture.endAllAsync();
      });

      it("ends a pasted run of several lines at a prompt on a new line after all its lines, without an end mark", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        const result: TerminalRunResult = await runAsync(fixture, { sessionId, command: "true\n(exit 4)" });
        const plainPrompt: string = `${mark(fixture, process, "A")}$ ${mark(fixture, process, "B")}`;

        process.emitData(`true\r\n\r\n(exit 4)\u001b[A\r${plainPrompt}true\r\n\r\n(exit 4)`);
        const afterRedraw: readonly JsonValue[] = [...fixture.runEnded.published];
        process.emitData(`\r\n${plainPrompt}`);

        assert.deepEqual(afterRedraw, []);
        assert.deepEqual(fixture.runEnded.published, [{ sessionId, runId: result.runId, endedBy: "Command", exitCode: null }]);
        await fixture.endAllAsync();
      });

      for (const [name, lastLine, echoed] of [
        ["a last line wider than the terminal, which readline wraps", "printf '%s' a-wide-argument", "printf '%s' a-wi\r\nde-argument"],
        ["a tab, which readline shows as spaces", "printf 'a\tb'", "printf 'a       b'"]
      ] as const)
        it(`ends a pasted run of several lines with ${name} at its command's end, not at bash's prompt drawn again over the paste`, async () => {
          const fixture: HostFixture = await HostFixture.createAsync();
          const { sessionId, process } = await openFreeAsync(fixture);
          const result: TerminalRunResult = await runAsync(fixture, { sessionId, command: `true\n${lastLine}` });
          const plainPrompt: string = `${mark(fixture, process, "A")}$ ${mark(fixture, process, "B")}`;

          process.emitData(`true\r\n\r\n${echoed}\u001b[A\r${plainPrompt}true\r\n\r\n${echoed}\r\n`);
          const afterRedraw: readonly JsonValue[] = [...fixture.runEnded.published];
          process.emitData(`${mark(fixture, process, "C")}${mark(fixture, process, "D", "4")}${plainPrompt}`);

          assert.deepEqual(afterRedraw, []);
          assert.deepEqual(fixture.runEnded.published, [{ sessionId, runId: result.runId, endedBy: "Command", exitCode: 4 }]);
          await fixture.endAllAsync();
        });

      it("ends a pasted run at a prompt without an end mark even when its output ends with the paste's last line", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        const result: TerminalRunResult = await runAsync(fixture, { sessionId, command: "true\ncat notes" });
        const plainPrompt: string = `${mark(fixture, process, "A")}$ ${mark(fixture, process, "B")}`;

        process.emitData(`true\r\n\r\ncat notes\u001b[A\r${plainPrompt}true\r\n\r\ncat notes\r\nsee: cat notes${plainPrompt}`);

        assert.deepEqual(fixture.runEnded.published, [{ sessionId, runId: result.runId, endedBy: "Command", exitCode: null }]);
        await fixture.endAllAsync();
      });

      it("ends a pasted run whose echo isn't found at its end mark, not at a prompt without one", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        const result: TerminalRunResult = await runAsync(fixture, { sessionId, command: "true\n(exit 4)" });
        const plainPrompt: string = `${mark(fixture, process, "A")}$ ${mark(fixture, process, "B")}`;

        process.emitData(`true\r\n>> (exit 4)\r\n${plainPrompt}`);
        const afterPrompt: readonly JsonValue[] = [...fixture.runEnded.published];
        process.emitData(`${mark(fixture, process, "C")}${mark(fixture, process, "D", "4")}${plainPrompt}`);

        assert.deepEqual(afterPrompt, []);
        assert.deepEqual(fixture.runEnded.published, [{ sessionId, runId: result.runId, endedBy: "Command", exitCode: 4 }]);
        await fixture.endAllAsync();
      });

      it("ends the run before as the next is typed, in the next one's answer to its window, or by the event to another window", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const sessionId: string = await fixture.openAsync(ownedOpen(OWNER));
        const process: FakePtyProcess = fixture.process;
        showPrompt(fixture, process, false);
        const plainPrompt: string = `${mark(fixture, process, "A")}$ ${mark(fixture, process, "B")}`;
        const other: RequestClient = new RequestClient(1, 2, true);
        vi.useFakeTimers({ toFake: ["Date"] });
        const first: TerminalRunResult = await runAsync(fixture, { sessionId, command: "if true\nthen make\nfi" });
        process.emitData(`if true\r\nthen make\r\nfi\r\n${mark(fixture, process, "C")}${mark(fixture, process, "D", "4")}${plainPrompt}`);
        settle();

        const second: TerminalRunResult = TerminalRunResult.fromJson(await fixture.host.handleAsync("terminal.run", { ...run, sessionId, command: "ls" }, APP));
        process.emitData(`ls\r\n${mark(fixture, process, "C")}${mark(fixture, process, "D", "0")}${plainPrompt}`);
        const third: TerminalRunResult = TerminalRunResult.fromJson(await fixture.host.handleAsync("terminal.run",
          { ...run, sessionId, command: "if true\nthen pwd\nfi" }, other));
        process.emitData(`if true\r\nthen pwd\r\nfi\r\n${mark(fixture, process, "C")}${mark(fixture, process, "D", "5")}${plainPrompt}`);
        settle();
        const fourth: TerminalRunResult = await runAsync(fixture, { sessionId, command: "true" });

        assert.deepEqual([first.outcome, second.outcome, third.outcome, fourth.outcome], ["Typed", "Typed", "Typed", "Typed"]);
        assert.deepEqual(second.endedRuns.map(t => t.toJson()), [{ sessionId, runId: first.runId, endedBy: "Command", exitCode: 4 }]);
        assert.deepEqual([third.endedRuns, fourth.endedRuns], [[], []]);
        assert.deepEqual([fixture.runEnded.published, fixture.runEnded.targets], [[
          { sessionId, runId: second.runId, endedBy: "Command", exitCode: 0 },
          { sessionId, runId: third.runId, endedBy: "Command", exitCode: 5 }
        ], ["1/1", "1/2"]]);
        vi.useRealTimers();
        await fixture.endAllAsync();
      });

      it("answers Busy to a run that comes after the first line of a run of several lines without bracketed paste ended, before the next line's echo, until the settle", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const sessionId: string = await fixture.openAsync(ownedOpen(OWNER));
        const process: FakePtyProcess = fixture.process;
        showPrompt(fixture, process, false);
        vi.useFakeTimers({ toFake: ["Date"] });
        await runAsync(fixture, { sessionId, command: "cd app\nnpm test" });
        process.emitData(`cd app\r\n${mark(fixture, process, "C")}${mark(fixture, process, "D", "0")}${mark(fixture, process, "A")}~/app $ ${mark(fixture, process, "B")}`);

        const busy: TerminalRunResult = await runAsync(fixture, { sessionId, command: "ls" });
        settle();
        const typed: TerminalRunResult = await runAsync(fixture, { sessionId, command: "ls" });
        vi.useRealTimers();

        assert.deepEqual([busy.outcome, typed.outcome, process.writes], ["Busy", "Typed", ["cd app\rnpm test\r", "ls\r"]]);
        await fixture.endAllAsync();
      });

      const ends: ReadonlyArray<readonly [string, (fixture: HostFixture, sessionId: string, process: FakePtyProcess) => Promise<unknown>]> = [
        ["its shell exits", async (_, __, process) => process.exit(0)],
        ["its terminal closes", async (fixture, sessionId) => fixture.host.handleAsync("terminal.close", { sessionId }, APP)],
        ["its terminal restarts", async (fixture, sessionId) => fixture.host.handleAsync("terminal.restart", { sessionId, size: SIZE }, APP)],
        ["the host ends", async fixture => fixture.host.endAllAsync()]
      ];
      for (const [name, endAsync] of ends)
        it(`ends a run still waiting when ${name}, as TerminalEnded, once`, async () => {
          const fixture: HostFixture = await HostFixture.createAsync();
          const { sessionId, process } = await openFreeAsync(fixture);
          const { runId } = await runAsync(fixture, { sessionId });
          process.emitData(`npm test\r\n${mark(fixture, process, "C")}`);

          await endAsync(fixture, sessionId, process);
          process.emitData(`${mark(fixture, process, "D", "0")}${prompt(fixture, process)}`);

          assert.deepEqual(fixture.runEnded.published, [{ sessionId, runId, endedBy: "TerminalEnded", exitCode: null }]);
          if (name !== "the host ends")
            await fixture.endAllAsync();
        });

      it("ends a run still waiting as its owner closes, before its shell ends, once", async () => {
        const fixture: HostFixture = await HostFixture.createAsync();
        const { sessionId, process } = await openFreeAsync(fixture);
        const { runId } = await runAsync(fixture, { sessionId });
        process.emitData(`npm test\r\n${mark(fixture, process, "C")}`);

        const closing: Promise<JsonValue> = fixture.host.handleAsync("terminal.closeOwner", { owner: OWNER }, APP);
        await vi.waitFor(() => assert.equal(fixture.closed.published.length, 1));
        const atClose: readonly JsonValue[] = [...fixture.runEnded.published];
        await closing;

        const ended: JsonValue = { sessionId, runId, endedBy: "TerminalEnded", exitCode: null };
        assert.deepEqual([atClose, fixture.runEnded.published], [[ended], [ended]]);
        await fixture.endAllAsync();
      });

      const closes: ReadonlyArray<readonly [string, (fixture: HostFixture) => Promise<unknown>]> = [
        ["its owner closes", async fixture => fixture.host.handleAsync("terminal.closeOwner", { owner: OWNER }, APP)],
        ["the app's connection closes", async fixture => fixture.host.closeConnectionAsync(APP.connection, null)]
      ];
      for (const [name, closeAsync] of closes)
        it(`answers Ended to a run waiting on a loaded shell's first prompt when ${name}, though the shell outlives its kill`, async () => {
          const fixture: HostFixture = await HostFixture.createAsync();
          fixture.spawner.isEndable = false;
          const { result, spawning } = await openNewAsync(fixture, {}, false);
          const process: FakePtyProcess = await readAsync(spawning);
          process.emitData(`\u001b]6973;L;${nonceOf(fixture, process)}\u0007`);
          await vi.waitFor(() => assert.ok(fixture.host.terminals.at(-1)?.session.commands.isLoaded));

          await closeAsync(fixture);

          assert.equal((await result).outcome, "Ended");
          assert.deepEqual(process.writes, []);
          await fixture.endAllAsync();
        });

      it("types a run into a new shell whose integration loaded but never ended its first prompt 60 seconds after its loaded mark, not before, and answers it as ended at once", async () => {
        vi.useFakeTimers();
        try {
          const fixture: HostFixture = await HostFixture.createAsync();
          const { result, process } = await startNewAsync(fixture);
          const nonce: string = nonceOf(fixture, process);
          process.emitData(`\u001b]6973;L;${nonce}\u0007\u001b]6973;P;${nonce};Cwd=/work\u0007\u001b]6973;A;${nonce}\u0007PS /work> `);

          await vi.advanceTimersByTimeAsync(59_999);
          const beforeLimit: readonly string[] = [...process.writes];
          await vi.advanceTimersByTimeAsync(1);
          const atLimit: readonly string[] = [...process.writes];
          await vi.advanceTimersByTimeAsync(1);
          const { sessionId, runId, outcome, endedRuns } = await result;

          assert.deepEqual([beforeLimit, atLimit, process.writes, outcome], [[], [], ["npm test\r"], "Typed"]);
          assert.deepEqual([endedRuns.map(t => t.toJson()), fixture.runEnded.published], [[{ sessionId, runId, endedBy: "NoIntegration", exitCode: null }], []]);
          vi.useRealTimers();
          await fixture.endAllAsync();
        }
        finally {
          vi.useRealTimers();
        }
      });

      it("answers a run into a new shell without the integration as ended at once, since its end can't be told", async () => {
        const fixture: HostFixture = await HostFixture.createAsync("win32", "10.0.26100", { SystemRoot: "C:\\Windows" });
        fixture.fileSystem.folders.add("C:\\work");
        const { result, process } = await startNewAsync(fixture, { folder: "C:\\work", shellKinds: ["CommandPrompt"], shellId: "cmd", command: "dir" });
        process.emitData("C:\\work>");
        const { sessionId, runId, endedRuns } = await result;
        process.emitData("dir\r\n Volume in drive C\r\nC:\\work>");

        assert.deepEqual([endedRuns.map(t => t.toJson()), fixture.runEnded.published], [[{ sessionId, runId, endedBy: "NoIntegration", exitCode: null }], []]);
        await fixture.endAllAsync();
      });
    });
  });

  describe("on Windows", () => {
    const environment: Readonly<Record<string, string | undefined>> = { SystemRoot: "C:\\Windows" };
    const open: Record<string, JsonValue> = { shellId: "cmd", folder: "C:\\work", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 };

    it("refuses a pane's folder that is absolute only on Linux and macOS", async () => {
      const fixture: HostFixture = await HostFixture.createAsync("win32", "10.0.26100", environment);

      await assert.rejects(fixture.openAsync({ shellId: "cmd", folder: "/work", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 }), /The value must be an absolute path\. \(Parameter 'folder'\)/u);
      assert.deepEqual(fixture.spawner.calls, []);
    });

    it("opens a terminal again in its Windows folder, and one whose folder is absolute only on Linux and macOS in the home folder", async () => {
      const fixture: HostFixture = await HostFixture.createAsync("win32", "10.0.26100", environment);
      fixture.fileSystem.folders.add("C:\\work");
      fixture.fileSystem.folders.add("/home/a");
      fixture.saved.save(new SavedTerminal("s1", "cmd", "C:\\work", false));
      fixture.saved.save(new SavedTerminal("s2", "cmd", "/work", false));

      await fixture.host.handleAsync("terminal.restore", RESTORE, APP);

      assert.deepEqual(fixture.spawner.calls.map(t => t.replace(/^.* in /u, "")).sort(), ["/home/a at 80x24", "C:\\work at 80x24"]);
      assert.deepEqual(fixture.log.messages, ["Terminal s2 opened in /home/a, since the folder /work does not exist."]);
    });

    it("opens an installed shell without waiting for the WSL distributions, and a distribution once they are read", async () => {
      const fixture: HostFixture = await HostFixture.createAsync("win32", "10.0.26100", environment);
      fixture.fileSystem.folders.add("C:\\work");
      let answer: (output: string) => void = () => undefined;
      fixture.runner.answers.set("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", new Promise<string>(resolve => {
        answer = resolve;
      }));

      await fixture.openAsync(open);
      const opening: Promise<string> = fixture.openAsync({ ...open, shellId: "wsl-Ubuntu" });
      answer(`${Buffer.from("Ubuntu").toString("base64")} 1\r\nEnd\r\n`);
      await opening;

      assert.deepEqual(fixture.spawner.calls, [
        "C:\\Windows\\System32\\cmd.exe [] in C:\\work at 80x24",
        "C:\\Windows\\System32\\wsl.exe [-d Ubuntu] in C:\\work at 80x24"
      ]);
    });

    it("tells the pane the ConPTY build of its Windows release", async () => {
      const fixture: HostFixture = await HostFixture.createAsync("win32", "10.0.26100", environment);
      fixture.fileSystem.folders.add("C:\\work");
      const sessionId: string = await fixture.openAsync(open);

      const attachment: TerminalAttachment = TerminalAttachment.fromJson(await fixture.host.handleAsync("terminal.attach", { sessionId, paneId: "p1" }, APP));

      assert.deepEqual(attachment.windowsPty?.toJson(), { backend: "conpty", buildNumber: 26_100 });
    });

    for (const release of ["10.0", "10.0.x", "10.0.26100abc"])
      it(`refuses to start on a Windows release that names no build, such as ${release}`, async () => {
        await assert.rejects(HostFixture.createAsync("win32", release, environment),
          (error: unknown) => error instanceof UnsupportedSystemException && error.requirement === "WindowsBuild" && error.found === release);
      });
  });
});
