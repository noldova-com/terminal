/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
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
});
