/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { CommandRun } from "../../src/models/command-run.ts";

describe("CommandRun", () => {
  it("holds the run's answer and its end", async () => {
    const run: CommandRun = new CommandRun(Promise.resolve("done"), Promise.resolve());

    assert.equal(await run.answer, "done");
    assert.equal(await run.ended, undefined);
  });
});
