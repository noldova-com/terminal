/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import assert from "node:assert/strict";
import path from "node:path";

import { ProcessExit } from "@noldova/desktop.runtime";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { describe, it } from "vitest";

import { CommandExitedException } from "../../src/exceptions/command-exited.exception.ts";
import { CommandNotStartedException } from "../../src/exceptions/command-not-started.exception.ts";
import { CommandTimedOutException } from "../../src/exceptions/command-timed-out.exception.ts";
import type { ICommandRunner } from "../../src/interfaces/i-command-runner.ts";
import { CommandRun } from "../../src/models/command-run.ts";
import { EnvironmentTools } from "../../src/models/environment-tools.ts";
import { RegistryValue } from "../../src/models/registry-value.ts";
import { LatestEnvironment } from "../../src/services/latest-environment.ts";
import { WindowsEnvironment } from "../../src/services/windows-environment.ts";
import { FakeFileSystemReader } from "../fixtures/fake-file-system-reader.fixture.ts";
import { FakeFileSystemWriter } from "../fixtures/fake-file-system-writer.fixture.ts";
import { FakeFolderAccess } from "../fixtures/fake-folder-access.fixture.ts";
import { FakeLineProcessStarter } from "../fixtures/fake-line-process.fixture.ts";
import { RecordedRun } from "../fixtures/recorded-run.fixture.ts";
import { RestrictedFolder } from "../fixtures/restricted-folder.fixture.ts";

type Scope = Readonly<Record<string, RegistryValue>>;

class ReadEndCase {
  public readonly name: string;
  public readonly isGone: boolean;

  public constructor(name: string, isGone: boolean) {
    this.name = name;
    this.isGone = isGone;
  }
}

class RemovalCase {
  public readonly name: string;
  public readonly failure: Error | null;
  public readonly atEnd: readonly string[];
  public readonly settled: readonly string[];
  public readonly logged: readonly string[];

  public constructor(name: string, failure: Error | null, atEnd: readonly string[], settled: readonly string[], logged: readonly string[]) {
    this.name = name;
    this.failure = failure;
    this.atEnd = atEnd;
    this.settled = settled;
    this.logged = logged;
  }
}

const MACHINE_KEY: string = "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment";
const USER_KEY: string = "HKCU\\Environment";
const REG: string = "C:\\Windows\\System32\\reg.exe";
const TEMPORARY: string = "C:\\Temp";
const FOLDER: string = `${path.join(TEMPORARY, "noldova-terminal-environment-")}1`;
const INHERITED: Readonly<Record<string, string | undefined>> = {
  SystemRoot: "C:\\Windows",
  Path: "C:\\Windows\\system32",
  TEMP: "C:\\Temp",
  OLD: "kept",
  UNSET: undefined
};
const UNREAD: string = "The shell starts with the app's environment, since the Windows environment could not be read: ";
const INVALID: string = "reg.exe did not export the machine's and the person's variables in a form that could be read.";
const CLEANUP: string = "The Windows environment's temporary files were not removed: ";
const MACHINE_UNREAD: string = "The key HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment could not be read. ";
const USER_UNREAD: string = "The key HKCU\\Environment could not be read. ";
const WRITE_FAILURE: string = "ERROR: Unable to write to the file. There may be a disk or file system error.";

function retried(key: string, text: string = WRITE_FAILURE): string {
  return `reg.exe could not export the key ${key}, which it finds, so it exports it once more in 250 ms: ${text}`;
}

function unwritten(text: string = WRITE_FAILURE): CommandExitedException {
  return new CommandExitedException("reg.exe", new ProcessExit(1, null), `${text}\r\n`);
}

function exportsOf(runner: ExportRunner): readonly string[] {
  return runner.runs.filter(t => t.args[0] === "export").map(t => t.args[2] ?? "");
}

function plain(variables: Readonly<Record<string, string>>): Scope {
  return Object.fromEntries(Object.entries(variables).map(([name, value]) => [name, new RegistryValue(value, false)]));
}

function quoted(text: string): string {
  return `"${text.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

function exported(key: string, scope: Scope): Uint8Array {
  const lines: string[] = ["Windows Registry Editor Version 5.00", "", `[${key}]`];
  for (const [name, { text: value, isExpandable }] of Object.entries(scope)) {
    if (!isExpandable) {
      lines.push(`${quoted(name)}=${quoted(value)}`);
      continue;
    }
    const bytes: string[] = [...Buffer.from(`${value}\u0000`, "utf16le")].map(t => t.toString(16).padStart(2, "0"));
    const rows: string[] = [];
    for (let start = 0; start < bytes.length; start += 25)
      rows.push(bytes.slice(start, start + 25).join(","));
    lines.push(`${quoted(name)}=hex(2):${rows.join(",\\\r\n  ")}`);
  }
  return Buffer.from(`\uFEFF${lines.join("\r\n")}\r\n\r\n`, "utf16le");
}

class ExportRunner implements ICommandRunner {
  public readonly runs: RecordedRun[] = [];
  public readonly answers: Map<string, Scope | Error> = new Map<string, Scope | Error>();
  public readonly failures: Map<string, Error[]> = new Map<string, Error[]>();
  public readonly present: Set<string> = new Set<string>([MACHINE_KEY, USER_KEY]);
  public queryFailure: Error | null = null;
  public held: PromiseWithResolvers<void> | null = null;
  public readonly entered: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly reader: FakeFileSystemReader;

  public constructor(reader: FakeFileSystemReader) {
    this.reader = reader;
  }

  public start(file: string, args: readonly string[], timeoutMilliseconds: number): CommandRun {
    const answer: Promise<string> = this.runAsync(file, args, timeoutMilliseconds);
    return new CommandRun(answer, answer.then(() => undefined, () => undefined));
  }

  public async runAsync(file: string, args: readonly string[], timeoutMilliseconds: number): Promise<string> {
    this.runs.push(new RecordedRun(file, args, timeoutMilliseconds));
    if (!Object.isNull(this.held)) {
      this.entered.resolve();
      await this.held.promise;
    }
    const [verb, key = "", target = ""] = args;
    if (verb === "query")
      return this.query(key);
    const failure: Error | undefined = this.failures.get(key)?.shift();
    if (!Object.isUndefined(failure))
      throw failure;
    const answer: Scope | Error | undefined = this.answers.get(key);
    if (answer instanceof Error)
      throw answer;
    if (!Object.isUndefined(answer))
      this.reader.bytes.set(target, exported(key, answer));
    return "The operation completed successfully.\r\n";
  }

  private query(key: string): string {
    if (!Object.isNull(this.queryFailure))
      throw this.queryFailure;
    if (!this.present.has(key))
      throw new CommandExitedException("reg.exe", new ProcessExit(1, null), "ERROR: The system was unable to find the specified registry key or value.\r\n");
    return `${key}\r\n`;
  }
}

class FolderWriter extends FakeFileSystemWriter {
  private readonly reader: FakeFileSystemReader;

  public constructor(reader: FakeFileSystemReader) {
    super();
    this.reader = reader;
  }

  public override async createPrivateFolderAsync(prefix: string): Promise<string> {
    const folder: string = await super.createPrivateFolderAsync(prefix);
    this.reader.folders.add(folder);
    return folder;
  }

  public override async removeFolderAsync(folder: string): Promise<void> {
    await super.removeFolderAsync(folder);
    this.reader.folders.delete(folder);
  }
}

class EnvironmentFixture {
  public readonly reader: FakeFileSystemReader = new FakeFileSystemReader();
  public readonly writer: FolderWriter = new FolderWriter(this.reader);
  public readonly access: FakeFolderAccess = new FakeFolderAccess(this.writer);
  public readonly runner: ExportRunner = new ExportRunner(this.reader);
  public readonly log: FakeModuleLog = new FakeModuleLog();
  public readonly source: WindowsEnvironment;

  public constructor(inherited: Readonly<Record<string, string | undefined>> = INHERITED) {
    this.source = new WindowsEnvironment(inherited, new EnvironmentTools(new FakeLineProcessStarter(), this.runner, this.reader, this.writer, this.access,
      TEMPORARY), this.log);
  }

  public async readAsync(machine: Scope, user: Scope): Promise<Readonly<Record<string, string | undefined>> | null> {
    this.answer(machine, user);
    return await this.source.readAsync();
  }

  public answer(machine: Scope | Error, user: Scope | Error): void {
    this.runner.answers.set(MACHINE_KEY, machine);
    this.runner.answers.set(USER_KEY, user);
  }
}

async function isWaitingAsync(promise: Promise<unknown>): Promise<boolean> {
  const waiting: unique symbol = Symbol("waiting");
  return await Promise.race([promise, Promise.resolve(waiting)]) === waiting;
}

describe("WindowsEnvironment", () => {
  it("exports the machine's and the person's keys with the system folder's reg.exe into a private folder, within 5 seconds, and removes each export", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();

    await fixture.readAsync({}, {});

    assert.deepEqual(fixture.runner.runs, [
      new RecordedRun(REG, ["export", MACHINE_KEY, path.win32.join(FOLDER, "machine-1.reg"), "/y"], 5_000),
      new RecordedRun(REG, ["export", USER_KEY, path.win32.join(FOLDER, "user-1.reg"), "/y"], 5_000)
    ]);
    assert.deepEqual(fixture.access.restricted, [new RestrictedFolder(FOLDER, 0)]);
    assert.deepEqual(fixture.writer.removedFiles, [path.win32.join(FOLDER, "machine-1.reg"), path.win32.join(FOLDER, "user-1.reg")]);
    assert.deepEqual(fixture.log.callsOf("write").map(t => t[0]), []);
  });

  it("reads once at the start", () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();
    fixture.answer({}, {});

    fixture.source.start();

    assert.equal(fixture.writer.folders, 1);
  });

  it("lays the machine's and then the person's variables over the inherited ones, matching names without regard to case", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();

    const environment: Readonly<Record<string, string | undefined>> | null = await fixture.readAsync(
      plain({ temp: "C:\\Windows\\Temp", SHARED: "machine", MACHINE_ONLY: "m" }),
      plain({ Shared: "user", USER_ONLY: "u" }));

    assert.deepEqual(environment, {
      SystemRoot: "C:\\Windows",
      Path: "C:\\Windows\\system32",
      temp: "C:\\Windows\\Temp",
      OLD: "kept",
      Shared: "user",
      MACHINE_ONLY: "m",
      USER_ONLY: "u"
    });
    assert.deepEqual(fixture.log.callsOf("write").map(t => t[0]), []);
  });

  it("expands the machine's and then the person's expandable values against what is set so far, such as a variable set after it started", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();

    const environment: Readonly<Record<string, string | undefined>> | null = await fixture.readAsync({
      Path: new RegistryValue("%SystemRoot%\\system32;%JAVA_HOME%\\bin", true),
      JAVA_HOME: new RegistryValue("C:\\jdk", false),
      EARLY: new RegistryValue("%USER_ONLY%", true)
    }, {
      Path: new RegistryValue("%java_home%\\tools;%TOOLS%", true),
      USER_ONLY: new RegistryValue("u", false),
      TOOLS: new RegistryValue("C:\\tools", false),
      RAW: new RegistryValue("%JAVA_HOME%", false)
    });

    assert.equal(environment?.["JAVA_HOME"], "C:\\jdk");
    assert.equal(environment?.["EARLY"], "%USER_ONLY%");
    assert.equal(environment?.["RAW"], "%JAVA_HOME%");
    assert.equal(environment?.["Path"], "C:\\Windows\\system32;C:\\jdk\\bin;C:\\jdk\\tools;C:\\tools");
  });

  it("keeps a % that names no variable as written", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();

    const environment: Readonly<Record<string, string | undefined>> | null = await fixture.readAsync({
      B: new RegistryValue("b", false),
      UNKNOWN: new RegistryValue("%NOPE%x%B%", true),
      PERCENT: new RegistryValue("50% and %%", true),
      UNCLOSED: new RegistryValue("%TEMP", true)
    }, {});

    assert.deepEqual([environment?.["UNKNOWN"], environment?.["PERCENT"], environment?.["UNCLOSED"]], ["%NOPE%xb", "50% and %%", "%TEMP"]);
  });

  it("joins the machine's Path with the person's, and takes either alone as it is", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();

    assert.equal((await fixture.readAsync(plain({ Path: "C:\\Windows\\system32;C:\\Tools" }), plain({ PATH: "D:\\bin" })))?.["Path"],
      "C:\\Windows\\system32;C:\\Tools;D:\\bin");
    assert.equal((await fixture.readAsync(plain({ Path: "C:\\Tools" }), {}))?.["Path"], "C:\\Tools");
    assert.equal((await fixture.readAsync({}, plain({ Path: "D:\\bin" })))?.["Path"], "D:\\bin");
  });

  it("keeps non-ASCII names and values, plain and expandable, as the UTF-16 export holds them", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();

    const environment: Readonly<Record<string, string | undefined>> | null = await fixture.readAsync(
      { ÖFFNEN: new RegistryValue("C:\\Öl\\%GRÜSSE%", true) },
      plain({ GRÜSSE: "Привет, 世界 😀", "QUOTE \"Ж\"": "a \\ \"b\"" }));

    assert.deepEqual([environment?.["GRÜSSE"], environment?.["ÖFFNEN"], environment?.["QUOTE \"Ж\""]],
      ["Привет, 世界 😀", "C:\\Öl\\%GRÜSSE%", "a \\ \"b\""]);
  });

  it("exports again for each shell into the same private folder", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();

    const first: Readonly<Record<string, string | undefined>> | null = await fixture.readAsync({}, plain({ STEP: "1" }));
    const second: Readonly<Record<string, string | undefined>> | null = await fixture.readAsync({}, plain({ STEP: "2" }));

    assert.deepEqual([first?.["STEP"], second?.["STEP"]], ["1", "2"]);
    assert.deepEqual(fixture.runner.runs.map(t => t.args[2]), [
      path.win32.join(FOLDER, "machine-1.reg"), path.win32.join(FOLDER, "user-1.reg"),
      path.win32.join(FOLDER, "machine-2.reg"), path.win32.join(FOLDER, "user-2.reg")
    ]);
    assert.equal(fixture.writer.folders, 1);
  });

  it("makes its private folder again when it's gone before an export, as when a temporary-file cleaner removed it, so reg.exe never writes into nothing", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();

    await fixture.readAsync({}, plain({ STEP: "1" }));
    fixture.reader.folders.delete(FOLDER);
    const second: Readonly<Record<string, string | undefined>> | null = await fixture.readAsync({}, plain({ STEP: "2" }));
    const third: Readonly<Record<string, string | undefined>> | null = await fixture.readAsync({}, plain({ STEP: "3" }));
    const remade: string = `${path.join(TEMPORARY, "noldova-terminal-environment-")}2`;

    assert.deepEqual([second?.["STEP"], third?.["STEP"], fixture.writer.folders], ["2", "3", 2]);
    assert.deepEqual(fixture.runner.runs.slice(2).map(t => t.args[2]), [
      path.win32.join(remade, "machine-2.reg"), path.win32.join(remade, "user-2.reg"),
      path.win32.join(remade, "machine-3.reg"), path.win32.join(remade, "user-3.reg")
    ]);
    assert.deepEqual(fixture.access.restricted.map(t => t.folder), [FOLDER, remade]);
  });

  it("makes a shell that opens before the first export ends wait for it, and gives shells that open together that one read", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();
    fixture.runner.held = Promise.withResolvers<void>();
    fixture.answer({}, plain({ FIRST: "yes" }));
    fixture.source.start();

    const first: Promise<Readonly<Record<string, string | undefined>> | null> = fixture.source.readAsync();
    const second: Promise<Readonly<Record<string, string | undefined>> | null> = fixture.source.readAsync();

    assert.ok(await isWaitingAsync(first));
    fixture.runner.held.resolve();
    assert.equal(await first, await second);
    assert.equal((await first)?.["FIRST"], "yes");
    assert.equal(fixture.runner.runs.length, 2);
  });

  it("gives no read when reg.exe fails or runs too long, and exports again for the next read", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();
    fixture.answer({}, new CommandTimedOutException("reg.exe", 5_000));

    const failed: Readonly<Record<string, string | undefined>> | null = await fixture.source.readAsync();
    const next: Readonly<Record<string, string | undefined>> | null = await fixture.readAsync({}, plain({ NEXT: "yes" }));

    assert.equal(failed, null);
    assert.equal(next?.["NEXT"], "yes");
    assert.deepEqual(fixture.log.callsOf("write").map(t => t[0]), [`${UNREAD}${USER_UNREAD}reg.exe did not end within 5 seconds.`]);
    assert.equal(fixture.writer.removedFiles.length, 4);
  });

  it("leaves completions the last good read when a later read times out, and a shell's start the inherited environment", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();
    const latest: LatestEnvironment = new LatestEnvironment(fixture.source, INHERITED);
    fixture.answer(plain({ GOOD: "yes" }), {});
    const good: Readonly<Record<string, string | undefined>> = await latest.readAsync();
    fixture.answer(new CommandTimedOutException("reg.exe", 5_000), {});

    const failed: Readonly<Record<string, string | undefined>> = await latest.readAsync();

    assert.deepEqual([good["GOOD"], failed, latest.read()["GOOD"]], ["yes", INHERITED, "yes"]);
    fixture.source.end();
  });

  it("logs why reg.exe could not start, from the failure's cause", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();
    fixture.answer(new CommandNotStartedException("reg.exe", new Error("refused")), {});

    assert.equal(await fixture.source.readAsync(), null);
    assert.deepEqual(fixture.log.callsOf("write").map(t => t[0]), [`${UNREAD}${MACHINE_UNREAD}reg.exe could not start. refused`]);
  });

  it("takes a key reg.exe refuses to export and then doesn't find, as a person's missing Environment key, as holding no variables, and logs nothing", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();
    fixture.runner.present.delete(USER_KEY);
    fixture.answer(plain({ MACHINE: "yes" }), new CommandExitedException("reg.exe", new ProcessExit(1, null)));

    const read: Readonly<Record<string, string | undefined>> | null = await fixture.source.readAsync();

    assert.equal(read?.["MACHINE"], "yes");
    assert.equal(read?.["Path"], INHERITED["Path"]);
    assert.deepEqual(fixture.log.callsOf("write").map(t => t[0]), []);
    assert.equal(fixture.writer.removedFiles.length, 2);
    assert.deepEqual(fixture.runner.runs.slice(1).map(t => t.args), [["export", USER_KEY, path.win32.join(FOLDER, "user-1.reg"), "/y"], ["query", USER_KEY]]);
  });

  it("gives no read, and logs the key and what reg.exe said, when reg.exe refuses the machine's key, which every Windows has", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();
    fixture.runner.present.delete(MACHINE_KEY);
    fixture.answer(new CommandExitedException("reg.exe", new ProcessExit(1, null), "ERROR: Access is denied.\r\n"), plain({ USER: "yes" }));

    assert.equal(await fixture.source.readAsync(), null);
    assert.deepEqual(fixture.log.callsOf("write").map(t => t[0]), [`${UNREAD}${MACHINE_UNREAD}reg.exe exited with 1: ERROR: Access is denied.`]);
    assert.deepEqual(fixture.runner.runs.map(t => t.args), [["export", MACHINE_KEY, path.win32.join(FOLDER, "machine-1.reg"), "/y"], ["query", MACHINE_KEY]]);
  });

  it("exports the person's key only once the machine's export ended, so two reg.exe never write at once", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();
    fixture.runner.held = Promise.withResolvers<void>();
    fixture.answer({}, plain({ USER: "yes" }));
    const reading: Promise<Readonly<Record<string, string | undefined>> | null> = fixture.source.readAsync();
    await fixture.runner.entered.promise;
    await new Promise<void>(resolve => setImmediate(resolve));

    const whileMachine: readonly string[] = fixture.runner.runs.map(t => t.args[1] ?? "");
    fixture.runner.held.resolve();

    assert.equal((await reading)?.["USER"], "yes");
    assert.deepEqual([whileMachine, fixture.runner.runs.map(t => t.args[1])], [[MACHINE_KEY], [MACHINE_KEY, USER_KEY]]);
  });

  it.each([["machine's", WRITE_FAILURE, MACHINE_KEY, "machine-1"], ["person's", WRITE_FAILURE, USER_KEY, "user-1"],
    ["person's", "FEHLER: In die Datei kann nicht geschrieben werden.", USER_KEY, "user-1"]])(
    "exports the %s key once more, 250 ms later into a file of a new name, when reg.exe failed its export with \"%s\" but finds the key, logs that, and removes both files",
    async (_name, text, key, file) => {
      const fixture: EnvironmentFixture = new EnvironmentFixture();
      fixture.runner.failures.set(key, [unwritten(text)]);
      fixture.answer(plain({ MACHINE: "yes" }), plain({ USER: "yes" }));
      const started: number = performance.now();

      const read: Readonly<Record<string, string | undefined>> | null = await fixture.source.readAsync();
      const waited: number = performance.now() - started;

      assert.deepEqual([read?.["MACHINE"], read?.["USER"]], ["yes", "yes"]);
      assert.ok(waited >= 240, `${waited}`);
      const files: readonly string[] = exportsOf(fixture.runner);
      assert.deepEqual(files.filter(t => path.win32.basename(t).startsWith(file)), [path.win32.join(FOLDER, `${file}.reg`), path.win32.join(FOLDER, `${file}-2.reg`)]);
      assert.deepEqual(fixture.runner.runs.filter(t => t.args[0] === "query").map(t => t.args), [["query", key]]);
      assert.deepEqual([...fixture.writer.removedFiles].sort(), [...files].sort());
      assert.deepEqual(fixture.log.callsOf("write").map(t => t[0]), [retried(key, text)]);
    });

  it.each([["machine's", MACHINE_KEY, MACHINE_UNREAD], ["person's", USER_KEY, USER_UNREAD]])(
    "gives no read, and logs what reg.exe said, when it can't export the %s key the second time either", async (_name, key, unread) => {
      const fixture: EnvironmentFixture = new EnvironmentFixture();
      fixture.runner.failures.set(key, [unwritten(), unwritten()]);
      fixture.answer(plain({ MACHINE: "yes" }), plain({ USER: "yes" }));

      assert.equal(await fixture.source.readAsync(), null);
      assert.deepEqual(fixture.log.callsOf("write").map(t => t[0]), [retried(key), `${UNREAD}${unread}reg.exe exited with 1: ${WRITE_FAILURE}`]);
      assert.equal(fixture.runner.runs.filter(t => t.args[0] === "export" && t.args[1] === key).length, 2);
    });

  it("gives no read, logs what the export said, and exports no more, when reg.exe can't tell whether the person's key is there", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();
    fixture.runner.failures.set(USER_KEY, [unwritten()]);
    fixture.runner.queryFailure = new CommandTimedOutException("reg.exe", 5_000);
    fixture.answer(plain({ MACHINE: "yes" }), plain({ USER: "yes" }));

    assert.equal(await fixture.source.readAsync(), null);
    assert.deepEqual(fixture.log.callsOf("write").map(t => t[0]), [`${UNREAD}${USER_UNREAD}reg.exe exited with 1: ${WRITE_FAILURE}`]);
    assert.deepEqual(exportsOf(fixture.runner), [path.win32.join(FOLDER, "machine-1.reg"), path.win32.join(FOLDER, "user-1.reg")]);
  });

  it("exports nothing more once it ended while it waited to export again, and removes its folder", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();
    fixture.runner.held = Promise.withResolvers<void>();
    fixture.runner.failures.set(MACHINE_KEY, [unwritten()]);
    fixture.answer({}, {});
    const reading: Promise<Readonly<Record<string, string | undefined>> | null> = fixture.source.readAsync();
    await fixture.runner.entered.promise;
    fixture.runner.held.resolve();
    await new Promise<void>(resolve => setImmediate(resolve));

    const logged: readonly unknown[] = fixture.log.callsOf("write").map(t => t[0]);
    fixture.source.end();
    const ended: Readonly<Record<string, string | undefined>> | null = await reading;
    await new Promise<void>(resolve => setImmediate(resolve));

    assert.equal(ended, INHERITED);
    assert.deepEqual(logged, [retried(MACHINE_KEY)]);
    assert.deepEqual([exportsOf(fixture.runner), fixture.writer.removed, fixture.writer.removedFiles],
      [[path.win32.join(FOLDER, "machine-1.reg")], [FOLDER, FOLDER], [path.win32.join(FOLDER, "machine-1.reg")]]);
  });

  it("makes a SystemRoot that is set but empty count as not set, giving no read, so it never runs a reg.exe relative to its folder", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture({ SystemRoot: "", Path: "C:\\bin" });

    assert.equal(await fixture.source.readAsync(), null);
    assert.deepEqual([fixture.runner.runs, fixture.writer.folders], [[], 0]);
    assert.deepEqual(fixture.log.callsOf("write").map(t => t[0]), [`${UNREAD}SystemRoot is not set, so reg.exe can't be found.`]);
  });

  it("gives no read when an export is missing or can't be read", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();
    fixture.runner.answers.set(USER_KEY, {});

    const missing: Readonly<Record<string, string | undefined>> | null = await fixture.source.readAsync();
    fixture.runner.answers.set(MACHINE_KEY, {});
    fixture.runner.answers.delete(USER_KEY);
    fixture.reader.bytes.set(path.win32.join(FOLDER, "user-2.reg"), Buffer.from("\uFEFF\"BROKEN\"=hex(2):zz,00", "utf16le"));
    const broken: Readonly<Record<string, string | undefined>> | null = await fixture.source.readAsync();

    assert.deepEqual([missing, broken], [null, null]);
    assert.deepEqual(fixture.log.callsOf("write").map(t => t[0]), [`${UNREAD}${INVALID}`, `${UNREAD}${INVALID}`]);
  });

  it("exports nothing into a folder it couldn't make private, removes that folder, and tries again for the next shell", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();
    fixture.access.failure = new Error("icacls failed.");
    fixture.answer({}, plain({ AFTER: "yes" }));

    const refused: Readonly<Record<string, string | undefined>> | null = await fixture.source.readAsync();
    fixture.access.failure = null;
    const next: Readonly<Record<string, string | undefined>> | null = await fixture.source.readAsync();

    assert.equal(refused, null);
    assert.equal(next?.["AFTER"], "yes");
    assert.deepEqual(fixture.writer.removed, [FOLDER]);
    assert.equal(fixture.runner.runs.length, 2);
    assert.deepEqual(fixture.log.callsOf("write").map(t => t[0]), [`${UNREAD}icacls failed.`]);
  });

  it("starts the waiting and later shells with the inherited environment at the end, exporting nothing once ended, and removes its folder", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();
    fixture.runner.held = Promise.withResolvers<void>();
    fixture.answer({}, {});
    const waiting: Promise<Readonly<Record<string, string | undefined>> | null> = fixture.source.readAsync();
    assert.ok(await isWaitingAsync(waiting));

    fixture.source.end();
    const ended: Readonly<Record<string, string | undefined>> | null = await waiting;
    const later: Readonly<Record<string, string | undefined>> | null = await fixture.source.readAsync();

    assert.deepEqual([ended, later], [INHERITED, INHERITED]);
    assert.deepEqual(fixture.writer.removed, [FOLDER]);
    assert.equal(fixture.runner.runs.length, 0);
  });

  it.each([new ReadEndCase("gone", true), new ReadEndCase("still there", false)])("makes no folder again and exports nothing for a read that was checking its folder when it ended, the folder $name", async ({ isGone }) => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();
    await fixture.readAsync({}, {});
    const hold: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    fixture.reader.hold = hold.promise;
    const reading: Promise<Readonly<Record<string, string | undefined>> | null> = fixture.source.readAsync();
    await fixture.reader.held.promise;

    fixture.source.end();
    const ended: Readonly<Record<string, string | undefined>> | null = await reading;
    if (isGone)
      fixture.reader.folders.delete(FOLDER);
    else
      fixture.reader.folders.add(FOLDER);
    hold.resolve();
    await new Promise<void>(resolve => setImmediate(resolve));

    assert.equal(ended, INHERITED);
    assert.deepEqual([fixture.writer.folders, fixture.runner.runs.length, fixture.log.callsOf("write").map(t => t[0])], [1, 2, []]);
  });

  it.each([new RemovalCase("", null, [FOLDER], [FOLDER, FOLDER], []),
    new RemovalCase(", and reads on and logs each time when it can't", new Error("The folder is in use."), [], [], [`${CLEANUP}The folder is in use.`, `${CLEANUP}The folder is in use.`])])(
    "removes its folder again once an export under way when it ended settles, as Windows refuses while reg.exe holds a file$name", async ({ failure, atEnd, settled, logged }) => {
      const fixture: EnvironmentFixture = new EnvironmentFixture();
      await fixture.readAsync({}, {});
      fixture.runner.held = Promise.withResolvers<void>();
      fixture.writer.removalFailure = failure;
      const reading: Promise<Readonly<Record<string, string | undefined>> | null> = fixture.source.readAsync();
      await fixture.runner.entered.promise;

      fixture.source.end();
      const ended: Readonly<Record<string, string | undefined>> | null = await reading;
      await new Promise<void>(resolve => setImmediate(resolve));
      const removedAtEnd: readonly string[] = [...fixture.writer.removed];
      fixture.runner.held.resolve();
      await new Promise<void>(resolve => setImmediate(resolve));

      assert.equal(ended, INHERITED);
      assert.deepEqual([removedAtEnd, fixture.writer.removed, fixture.log.callsOf("write").map(t => t[0])], [atEnd, settled, logged]);
      assert.deepEqual(fixture.runner.runs.slice(2).map(t => t.args[1]), [MACHINE_KEY]);
    });

  it("reads on and logs when an export, a refused folder or its folder at the end can't be removed, and logs a folder that couldn't be made", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();
    fixture.writer.fileRemovalFailure = new Error("The export is in use.");
    fixture.writer.removalFailure = new Error("The folder is in use.");
    fixture.writer.failure = "no space left";

    const unmade: Readonly<Record<string, string | undefined>> | null = await fixture.source.readAsync();
    fixture.writer.failure = null;
    fixture.access.failure = new Error("icacls failed.");
    const refused: Readonly<Record<string, string | undefined>> | null = await fixture.source.readAsync();
    fixture.access.failure = null;
    const read: Readonly<Record<string, string | undefined>> | null = await fixture.readAsync({}, plain({ READ: "yes" }));
    fixture.source.end();
    await new Promise<void>(resolve => setImmediate(resolve));

    assert.deepEqual([unmade, refused, read?.["READ"]], [null, null, "yes"]);
    assert.deepEqual(fixture.log.callsOf("write").map(t => t[0]), [`${UNREAD}no space left`, `${CLEANUP}The folder is in use.`, `${UNREAD}icacls failed.`,
      `${CLEANUP}The export is in use.`, `${CLEANUP}The export is in use.`, `${CLEANUP}The folder is in use.`]);
    assert.deepEqual([fixture.writer.removed, fixture.writer.removedFiles], [[], []]);
  });

  it("ends without having read anything", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture();

    fixture.source.end();

    assert.equal(await fixture.source.readAsync(), INHERITED);
    assert.deepEqual([fixture.runner.runs, fixture.writer.removed, fixture.writer.folders], [[], [], 0]);
  });

  it("gives no read, running nothing, when SystemRoot is not set", async () => {
    const fixture: EnvironmentFixture = new EnvironmentFixture({ Path: "C:\\bin" });

    assert.equal(await fixture.source.readAsync(), null);
    assert.deepEqual([fixture.runner.runs, fixture.writer.folders], [[], 0]);
    assert.deepEqual(fixture.log.callsOf("write").map(t => t[0]), [`${UNREAD}SystemRoot is not set, so reg.exe can't be found.`]);
  });
});
