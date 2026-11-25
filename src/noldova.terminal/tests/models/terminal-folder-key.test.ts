/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalFolderKey } from "../../src/models/terminal-folder-key.ts";

describe("TerminalFolderKey", () => {
  it("holds the folder and the key it is given", () => {
    const folderKey: TerminalFolderKey = new TerminalFolderKey("/work/project", "key-1");

    assert.equal(folderKey.folder, "/work/project");
    assert.equal(folderKey.key, "key-1");
  });
});
