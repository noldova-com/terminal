/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { PowerShellCmdlet } from "../../src/models/powershell-cmdlet.ts";
import { PowerShellParameter } from "../../src/models/powershell-parameter.ts";

describe("PowerShellCmdlet", () => {
  it("holds its names, Windows aliases, positions, parameters and dynamic parameters", () => {
    const path: PowerShellParameter = new PowerShellParameter("Path", false);
    const stream: PowerShellParameter = new PowerShellParameter("Stream", false);
    const cmdlet: PowerShellCmdlet = new PowerShellCmdlet(["Get-Content", "gc"], ["cat", "type"], ["Path"], [path], [stream]);

    assert.deepEqual(cmdlet.names, ["Get-Content", "gc"]);
    assert.deepEqual(cmdlet.windowsAliases, ["cat", "type"]);
    assert.deepEqual(cmdlet.positions, ["Path"]);
    assert.deepEqual(cmdlet.parameters, [path]);
    assert.deepEqual(cmdlet.dynamicParameters, [stream]);
  });

  it("has no dynamic parameters by default", () => {
    const cmdlet: PowerShellCmdlet = new PowerShellCmdlet(["Get-Location"], [], [], []);

    assert.deepEqual(cmdlet.dynamicParameters, []);
  });
});
