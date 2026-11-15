/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { join } from "node:path";

import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { describe, it } from "vitest";

import { TerminalHistoryPaths } from "../../src/models/terminal-history-paths.ts";
import { TerminalHistoryFolder } from "../../src/services/terminal-history-folder.ts";
import { FakeFileSystemReader } from "../fixtures/fake-file-system-reader.fixture.ts";
import { FakeFileSystemWriter } from "../fixtures/fake-file-system-writer.fixture.ts";
import { FakeFolderAccess } from "../fixtures/fake-folder-access.fixture.ts";
import { FakeProcessSignaller } from "../fixtures/fake-process-signaller.fixture.ts";

const TEMP: string = join("/", "tmp");

class FolderFixture {
  public readonly writer: FakeFileSystemWriter = new FakeFileSystemWriter();
  public readonly reader: FakeFileSystemReader = new FakeFileSystemReader();
  public readonly signaller: FakeProcessSignaller = new FakeProcessSignaller();
  public readonly log: FakeModuleLog = new FakeModuleLog();
  public readonly access: FakeFolderAccess = new FakeFolderAccess(this.writer);
  public readonly folder: TerminalHistoryFolder;

  public constructor(hasAccess: boolean = false) {
    this.folder = new TerminalHistoryFolder(this.writer, this.reader, this.signaller, TEMP, 400, this.log, hasAccess ? this.access : null);
  }

  public get messages(): readonly unknown[] {
    return this.log.callsOf("write").map(t => t[0]);
  }
}

describe("TerminalHistoryFolder", () => {
  it("makes one private folder named for the runtime's process, with two files for each terminal", async () => {
    const fixture: FolderFixture = new FolderFixture();

    const [first, second] = await Promise.all([fixture.folder.pathsAsync("s1"), fixture.folder.pathsAsync("s2")]);

    const folder: string = join(TEMP, "noldova-terminal-lines-400-1");
    assert.deepEqual([first, second], [new TerminalHistoryPaths(join(folder, "s1-1.jsonl"), join(folder, "s1-2.jsonl")),
      new TerminalHistoryPaths(join(folder, "s2-1.jsonl"), join(folder, "s2-2.jsonl"))]);
    assert.equal(fixture.writer.folders, 1);
  });

  it("first removes the folders that runtimes no longer running left, and no other folder", async () => {
    const fixture: FolderFixture = new FolderFixture();
    for (const name of ["noldova-terminal-lines-17-Ab3dE9", "noldova-terminal-lines-18-xYz012", "noldova-terminal-lines-400-Qq1234",
      "noldova-terminal-lines-x-Qq1234", "noldova-terminal-lines-19-short", "noldova-terminal-Ab3dE9", "other"])
      fixture.reader.folders.add(join(TEMP, name));
    fixture.reader.folders.add(join(TEMP, "other", "noldova-terminal-lines-20-Ab3dE9"));
    fixture.signaller.running.add(18);

    await fixture.folder.pathsAsync("s1");
    await fixture.folder.pathsAsync("s2");

    assert.deepEqual(fixture.writer.removed, [join(TEMP, "noldova-terminal-lines-17-Ab3dE9")]);
  });

  it("logs a leftover it can't remove, and still makes its folder", async () => {
    const fixture: FolderFixture = new FolderFixture();
    fixture.reader.folders.add(join(TEMP, "noldova-terminal-lines-17-Ab3dE9"));
    fixture.writer.removalFailure = new Error("EPERM");

    await fixture.folder.pathsAsync("s1");

    assert.deepEqual(fixture.messages, [`The stored lines in ${join(TEMP, "noldova-terminal-lines-17-Ab3dE9")} could not be removed: EPERM`]);
    assert.equal(fixture.writer.folders, 1);
  });

  it("fails the open that can't make the folder, and tries again at the next", async () => {
    const fixture: FolderFixture = new FolderFixture();
    fixture.writer.failure = new Error("ENOSPC");

    await assert.rejects(fixture.folder.pathsAsync("s1"), { message: "ENOSPC" });
    fixture.writer.failure = null;

    assert.deepEqual(await fixture.folder.pathsAsync("s2"), new TerminalHistoryPaths(join(TEMP, "noldova-terminal-lines-400-1", "s2-1.jsonl"),
      join(TEMP, "noldova-terminal-lines-400-1", "s2-2.jsonl")));
  });

  it("makes its folder private before it gives any terminal its files, once for all terminals", async () => {
    const fixture: FolderFixture = new FolderFixture(true);

    const paths: (TerminalHistoryPaths | null)[] = await Promise.all([fixture.folder.pathsAsync("s1"), fixture.folder.pathsAsync("s2")]);

    assert.equal(paths.filter(t => t !== null).length, 2);
    assert.deepEqual(fixture.access.restricted, [[join(TEMP, "noldova-terminal-lines-400-1"), 0]]);
  });

  it("gives the open no files, logs why and removes the folder, when the folder can't be made private, and tries again at the next",
    async () => {
      const fixture: FolderFixture = new FolderFixture(true);
      fixture.access.failure = new Error("icacls.exe exited with 5.");

      const failed: (TerminalHistoryPaths | null)[] = await Promise.all([fixture.folder.pathsAsync("s1"), fixture.folder.pathsAsync("s2")]);
      fixture.access.failure = null;
      const next: TerminalHistoryPaths | null = await fixture.folder.pathsAsync("s3");

      assert.deepEqual(failed, [null, null]);
      assert.deepEqual(fixture.writer.removed, [join(TEMP, "noldova-terminal-lines-400-1")]);
      assert.equal(next?.first, join(TEMP, "noldova-terminal-lines-400-2", "s3-1.jsonl"));
      assert.deepEqual(fixture.messages, ["A terminal opens without stored lines, whose folder could not be made private: icacls.exe exited with 5."]);
    });

  it("logs a folder it can't make private nor remove, and still gives the open no files", async () => {
    const fixture: FolderFixture = new FolderFixture(true);
    fixture.access.failure = new Error("icacls.exe exited with 5.");
    fixture.writer.removalFailure = "EBUSY";

    assert.equal(await fixture.folder.pathsAsync("s1"), null);

    assert.deepEqual(fixture.messages, ["A terminal opens without stored lines, whose folder could not be made private: icacls.exe exited with 5.",
      `The stored lines in ${join(TEMP, "noldova-terminal-lines-400-1")} could not be removed: EBUSY`]);
  });

  it("removes nothing more when the folder it was making couldn't be made private", async () => {
    const fixture: FolderFixture = new FolderFixture(true);
    fixture.access.failure = new Error("icacls.exe exited with 5.");

    const opening: Promise<TerminalHistoryPaths | null> = fixture.folder.pathsAsync("s1");
    await fixture.folder.removeAsync();

    assert.equal(await opening, null);
    assert.deepEqual(fixture.writer.removed, [join(TEMP, "noldova-terminal-lines-400-1")]);
  });

  it("removes its folder once, and nothing when it made none", async () => {
    const fixture: FolderFixture = new FolderFixture();
    await fixture.folder.removeAsync();
    await fixture.folder.pathsAsync("s1");

    await fixture.folder.removeAsync();
    await fixture.folder.removeAsync();

    assert.deepEqual(fixture.writer.removed, [join(TEMP, "noldova-terminal-lines-400-1")]);
  });

  it("removes nothing when the folder it was making couldn't be made, and logs why", async () => {
    const fixture: FolderFixture = new FolderFixture();
    fixture.writer.failure = new Error("ENOSPC");

    const opening: Promise<unknown> = fixture.folder.pathsAsync("s1").catch((t: unknown) => t);
    await fixture.folder.removeAsync();

    const error: unknown = await opening;
    assert.ok(error instanceof Error && error.message === "ENOSPC", String(error));
    assert.deepEqual([fixture.writer.removed, fixture.messages], [[], ["The folder for the terminals' stored lines could not be made: ENOSPC"]]);
  });

  it("logs a folder it can't remove", async () => {
    const fixture: FolderFixture = new FolderFixture();
    await fixture.folder.pathsAsync("s1");
    fixture.writer.removalFailure = "EBUSY";

    await fixture.folder.removeAsync();

    assert.deepEqual(fixture.messages, [`The stored lines in ${join(TEMP, "noldova-terminal-lines-400-1")} could not be removed: EBUSY`]);
  });
});
