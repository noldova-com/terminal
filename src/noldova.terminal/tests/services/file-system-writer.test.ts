/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { describe, it } from "vitest";

import { FileSystemWriter } from "../../src/services/file-system-writer.ts";

describe("FileSystemWriter", () => {
  it("creates a new private folder, writes text into it once, and removes it", async () => {
    const writer: FileSystemWriter = new FileSystemWriter();
    const folder: string = await writer.createPrivateFolderAsync(join(tmpdir(), "terminal-file-system-writer-"));
    const file: string = join(folder, "script");

    assert.equal(dirname(folder), tmpdir());
    assert.match(basename(folder), /^terminal-file-system-writer-.{6}$/u);
    await writer.writeTextAsync(file, "echo é\n");
    assert.equal(await readFile(file, "utf8"), "echo é\n");
    if (process.platform !== "win32")
      assert.equal((await stat(file)).mode & 0o777, 0o600);
    await assert.rejects(writer.writeTextAsync(file, "again"), { code: "EEXIST" });
    await writer.appendTextAsync(join(folder, "log"), "one ");
    await writer.appendTextAsync(join(folder, "log"), "two");
    assert.equal(await readFile(join(folder, "log"), "utf8"), "one two");
    await writer.removeFileAsync(file);
    await assert.rejects(stat(file), { code: "ENOENT" });
    await writer.removeFileAsync(file);
    assert.equal(await readFile(join(folder, "log"), "utf8"), "one two");

    await writer.removeFolderAsync(folder);

    await assert.rejects(stat(folder), { code: "ENOENT" });
    await writer.removeFolderAsync(folder);
  });

  it("makes a missing folder and its parents with the mode it's given, and leaves a folder that exists and its contents as they are", async () => {
    const writer: FileSystemWriter = new FileSystemWriter();
    const root: string = await mkdtemp(join(tmpdir(), "terminal-missing-folder-"));
    const made: string = join(root, "made", ".dotnet", "shm");
    const kept: string = join(root, "kept", ".dotnet", "shm");
    try {
      await mkdir(kept, { recursive: true });
      await writeFile(join(kept, "session1"), "held");
      if (process.platform !== "win32")
        await chmod(kept, 0o755);

      await writer.createMissingFolderAsync(made, 0o700);
      await writer.createMissingFolderAsync(kept, 0o700);

      assert.equal((await stat(made)).isDirectory(), true);
      assert.deepEqual(await readdir(kept), ["session1"]);
      assert.equal(await readFile(join(kept, "session1"), "utf8"), "held");
      if (process.platform !== "win32") {
        assert.deepEqual([(await stat(dirname(made))).mode & 0o777, (await stat(made)).mode & 0o777], [0o700, 0o700]);
        assert.equal((await stat(kept)).mode & 0o777, 0o755);
      }
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
