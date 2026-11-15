/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { FolderEntry } from "../../src/models/folder-entry.ts";

describe("FolderEntry", () => {
  it("holds a folder's name and that it is a folder", () => {
    const entry: FolderEntry = new FolderEntry("src", true);

    assert.equal(entry.name, "src");
    assert.equal(entry.isFolder, true);
  });

  it("holds a file's name and that it is not a folder", () => {
    const entry: FolderEntry = new FolderEntry("README.md", false);

    assert.equal(entry.name, "README.md");
    assert.equal(entry.isFolder, false);
  });
});
