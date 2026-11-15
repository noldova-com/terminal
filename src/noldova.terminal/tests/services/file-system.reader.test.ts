/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { chmod, lstat, mkdir, mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, it } from "vitest";

import { FileSystemReader } from "../../src/services/file-system.reader.ts";

describe("FileSystemReader", () => {
  let folder: string = "";
  let file: string = "";

  beforeAll(async () => {
    folder = await mkdtemp(join(tmpdir(), "terminal-file-system-reader-"));
    file = join(folder, "shells");
    await writeFile(file, "/bin/bash\n", "utf8");
  });

  afterAll(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it("tells files from folders", async () => {
    const reader: FileSystemReader = new FileSystemReader();

    assert.equal(await reader.isFileAsync(file), true);
    assert.equal(await reader.isFolderAsync(file), false);
    assert.equal(await reader.isFileAsync(folder), false);
    assert.equal(await reader.isFolderAsync(folder), true);
  });

  it("finds neither where nothing exists", async () => {
    const reader: FileSystemReader = new FileSystemReader();

    assert.equal(await reader.isFileAsync(join(folder, "gone")), false);
    assert.equal(await reader.isFolderAsync(join(folder, "gone")), false);
  });

  it("takes a file as a program, and not a folder, nothing, a link to a folder or to nothing, or a link loop", async () => {
    const reader: FileSystemReader = new FileSystemReader();
    const links: string = await mkdtemp(join(tmpdir(), "terminal-file-system-links-"));
    try {
      await mkdir(join(links, "target"));
      await symlink(join(links, "target"), join(links, "to-folder"), "junction");
      await symlink(join(links, "gone"), join(links, "to-nothing"), "junction");
      await symlink(join(links, "loop-b"), join(links, "loop-a"), "junction");
      await symlink(join(links, "loop-a"), join(links, "loop-b"), "junction");

      assert.equal(await reader.isProgramAsync(file), true);
      assert.equal(await reader.isProgramAsync(folder), false);
      assert.equal(await reader.isProgramAsync(join(links, "gone")), false);
      assert.equal(await reader.isProgramAsync(join(links, "to-folder")), false);
      assert.equal(await reader.isProgramAsync(join(links, "to-nothing")), false);
      assert.equal(await reader.isProgramAsync(join(links, "loop-a")), false);
    }
    finally {
      await rm(links, { recursive: true, force: true });
    }
  });

  it("takes a link that stat may not open as a program, as Windows does an app execution alias, but not a file it may not open", async context => {
    context.skip(process.platform === "win32", "Windows has no mode that locks a folder against stat; the app execution alias test covers it there.");
    const reader: FileSystemReader = new FileSystemReader();
    const links: string = await mkdtemp(join(tmpdir(), "terminal-file-system-locked-"));
    const locked: string = join(links, "locked");
    await mkdir(locked);
    await writeFile(join(locked, "pwsh"), "");
    await symlink(join(locked, "pwsh"), join(links, "pwsh"));
    await chmod(locked, 0o000);
    try {
      assert.equal(await reader.isProgramAsync(join(links, "pwsh")), true);
      assert.equal(await reader.isProgramAsync(join(locked, "pwsh")), false);
    }
    finally {
      await chmod(locked, 0o700);
      await rm(links, { recursive: true, force: true });
    }
  });

  it("takes an app execution alias as a program, though it isn't a file to stat", async context => {
    context.skip(process.platform !== "win32", "Only Windows has app execution aliases.");
    const aliasFolder: string = join(process.env["LOCALAPPDATA"] ?? "", "Microsoft", "WindowsApps");
    const names: readonly string[] = await readdir(aliasFolder).catch((error: unknown) => {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
        throw error;
      return [];
    });
    const links: boolean[] = await Promise.all(names.map(async t => (await lstat(join(aliasFolder, t))).isSymbolicLink()));
    const alias: string | undefined = names.find((t, i) => t.endsWith(".exe") && links[i] === true);
    context.skip(alias === undefined, "This Windows has no app execution alias.");
    const reader: FileSystemReader = new FileSystemReader();

    assert.equal(await reader.isFileAsync(join(aliasFolder, alias ?? "")), false);
    assert.equal(await reader.isProgramAsync(join(aliasFolder, alias ?? "")), true);
  });

  it("reads a text file, and null where none exists", async () => {
    const reader: FileSystemReader = new FileSystemReader();

    assert.equal(await reader.readTextOrNullAsync(file), "/bin/bash\n");
    assert.equal(await reader.readTextOrNullAsync(join(folder, "gone")), null);
  });

  it("reads a file's bytes as they are, and none for a file that isn't there", async () => {
    const reader: FileSystemReader = new FileSystemReader();

    assert.deepEqual([...await reader.readBytesOrNullAsync(file) ?? []], [...Buffer.from("/bin/bash\n")]);
    assert.equal(await reader.readBytesOrNullAsync(join(folder, "gone")), null);
  });

  it("lists the folders in a folder, and none where it can't be read", async () => {
    const reader: FileSystemReader = new FileSystemReader();
    const outer: string = await mkdtemp(join(tmpdir(), "terminal-file-system-folders-"));
    try {
      await mkdir(join(outer, "inner"));
      await writeFile(join(outer, "file"), "");

      assert.deepEqual(await reader.readFolderNamesAsync(outer), ["inner"]);
      assert.deepEqual(await reader.readFolderNamesAsync(join(outer, "gone")), []);
      assert.deepEqual(await reader.readFolderNamesAsync(join(outer, "file")), []);
    }
    finally {
      await rm(outer, { recursive: true, force: true });
    }
  });

  it("lists a folder's names, telling folders and links to them from files and links to nothing, and none where it can't be read", async () => {
    const reader: FileSystemReader = new FileSystemReader();
    const entries: string = await mkdtemp(join(tmpdir(), "terminal-file-system-entries-"));
    await writeFile(join(entries, "file"), "");
    await mkdir(join(entries, "folder"));
    await symlink(join(entries, "folder"), join(entries, "to-folder"), "junction");
    await symlink(join(entries, "gone"), join(entries, "to-nothing"), "junction");
    try {
      const listed: readonly [string, boolean][] = (await reader.readEntriesAsync(entries)).map((t): [string, boolean] => [t.name, t.isFolder])
        .sort(([a], [b]) => a.localeCompare(b));

      assert.deepEqual(listed, [["file", false], ["folder", true], ["to-folder", true], ["to-nothing", false]]);
      assert.deepEqual(await reader.readEntriesAsync(join(entries, "gone")), []);
      assert.deepEqual(await reader.readEntriesAsync(join(entries, "file")), []);
    }
    finally {
      await rm(entries, { recursive: true, force: true });
    }
  });

  it("reads nothing from a person's folder that is a link loop or has too long a name", async () => {
    const reader: FileSystemReader = new FileSystemReader();
    const links: string = await mkdtemp(join(tmpdir(), "terminal-file-system-loop-"));
    await symlink(join(links, "loop-b"), join(links, "loop-a"), "junction");
    await symlink(join(links, "loop-a"), join(links, "loop-b"), "junction");
    const long: string = join(folder, "a".repeat(5000));
    try {
      assert.deepEqual(await reader.readEntriesAsync(join(links, "loop-a")), []);
      assert.deepEqual(await reader.readFolderNamesAsync(join(links, "loop-a")), []);
      assert.equal(await reader.readTextOrNullAsync(join(links, "loop-a", "package.json")), null);
      assert.equal(await reader.isFolderAsync(join(links, "loop-a")), false);
      assert.deepEqual(await reader.readEntriesAsync(long), []);
      assert.equal(await reader.readTextOrNullAsync(long), null);
    }
    finally {
      await rm(links, { recursive: true, force: true });
    }
  });

  it("passes on a failure other than a missing path", async () => {
    const reader: FileSystemReader = new FileSystemReader();
    const invalid: string = join(folder, "bad\u0000name");

    await assert.rejects(reader.readTextOrNullAsync(folder), { code: "EISDIR" });
    await assert.rejects(reader.readBytesOrNullAsync(folder), { code: "EISDIR" });
    for (const read of [(): Promise<unknown> => reader.isFileAsync(invalid), (): Promise<unknown> => reader.isProgramAsync(invalid), (): Promise<unknown> => reader.isFolderAsync(invalid),
      (): Promise<unknown> => reader.readFolderNamesAsync(invalid), (): Promise<unknown> => reader.readEntriesAsync(invalid)])
      await assert.rejects(read(), { code: "ERR_INVALID_ARG_VALUE" });
  });

  it("reads nothing from a person's file or folder it may not open, but passes on its own export it may not open", async context => {
    context.skip(process.platform === "win32", "Windows has no file mode that denies its owner a read.");
    const reader: FileSystemReader = new FileSystemReader();
    const locked: string = await mkdtemp(join(tmpdir(), "terminal-file-system-denied-"));
    const text: string = join(locked, "package.json");
    await writeFile(text, "{}");
    await chmod(text, 0o000);
    await mkdir(join(locked, "inner"), { mode: 0o000 });
    try {
      assert.equal(await reader.readTextOrNullAsync(text), null);
      assert.deepEqual(await reader.readEntriesAsync(join(locked, "inner")), []);
      assert.deepEqual(await reader.readFolderNamesAsync(join(locked, "inner")), []);
      assert.equal(await reader.isFileAsync(join(locked, "inner", "pwsh")), false);
      await assert.rejects(reader.readBytesOrNullAsync(text), { code: "EACCES" });
    }
    finally {
      await chmod(text, 0o600);
      await chmod(join(locked, "inner"), 0o700);
      await rm(locked, { recursive: true, force: true });
    }
  });
});
