/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { EnvironmentVariable } from "../../src/models/environment-variable.ts";

describe("EnvironmentVariable", () => {
  it("keeps its name as written and its value", () => {
    const variable: EnvironmentVariable = new EnvironmentVariable("Path", "C:\\Windows");

    assert.deepEqual([variable.name, variable.value], ["Path", "C:\\Windows"]);
  });
});
