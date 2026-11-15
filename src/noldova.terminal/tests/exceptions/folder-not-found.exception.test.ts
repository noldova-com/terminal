/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { FolderNotFoundException } from "../../src/exceptions/folder-not-found.exception.ts";

describe("FolderNotFoundException", () => {
  it("names the folder it did not find", () => {
    const error: FolderNotFoundException = new FolderNotFoundException("/gone");

    assert.ok(error instanceof Error);
    assert.equal(error.name, "FolderNotFoundException");
    assert.equal(error.folder, "/gone");
    assert.equal(error.message, "The folder /gone does not exist.");
  });
});
