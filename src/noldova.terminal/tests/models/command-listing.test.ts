/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { CommandListing } from "../../src/models/command-listing.ts";

describe("CommandListing", () => {
  it("holds the prompt and search it was listed for, and the commands it found", () => {
    const listing: CommandListing = new CommandListing(3, "[\"Bash\",\"/usr/bin\"]", ["git", "ls"]);

    assert.deepEqual([listing.prompt, listing.search, listing.commands], [3, "[\"Bash\",\"/usr/bin\"]", ["git", "ls"]]);
  });
});
