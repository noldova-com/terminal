/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { PowerShellLookup } from "../../src/models/powershell-lookup.ts";

describe("PowerShellLookup", () => {
  it("holds the shell's names and search it looked up for, and the answers it keeps", () => {
    const names: ReadonlySet<string> = new Set<string>(["Get-Item"]);
    const answers: Map<string, boolean> = new Map<string, boolean>([["gti", true]]);
    const lookup: PowerShellLookup = new PowerShellLookup(names, "[\"pwsh\",{}]", answers);

    assert.equal(lookup.shellNames, names);
    assert.equal(lookup.search, "[\"pwsh\",{}]");
    assert.equal(lookup.answers, answers);
  });
});
