/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { PowerShellParameter } from "../../src/models/powershell-parameter.ts";

describe("PowerShellParameter", () => {
  it("holds its name, whether it is a switch, its aliases and its slot", () => {
    const parameter: PowerShellParameter = new PowerShellParameter("LiteralPath", false, ["PSPath", "LP"], "Path");

    assert.equal(parameter.name, "LiteralPath");
    assert.equal(parameter.isSwitch, false);
    assert.deepEqual(parameter.aliases, ["PSPath", "LP"]);
    assert.equal(parameter.slot, "Path");
  });

  it("has no aliases and its own name as its slot by default", () => {
    const parameter: PowerShellParameter = new PowerShellParameter("Force", true);

    assert.equal(parameter.isSwitch, true);
    assert.deepEqual(parameter.aliases, []);
    assert.equal(parameter.slot, "Force");
  });
});
