/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ArgumentProblem } from "../../src/models/argument-problem.ts";

describe("ArgumentProblem", () => {
  it("holds the parameter, the reason that names it and the message that doesn't", () => {
    const problem: ArgumentProblem = new ArgumentProblem("folder", "folder must be an absolute path.", "The value must be an absolute path.");

    assert.deepEqual([problem.parameterName, problem.reason, problem.message],
      ["folder", "folder must be an absolute path.", "The value must be an absolute path."]);
  });
});
