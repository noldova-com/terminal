/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TrackedCommand } from "../../src/models/tracked-command.ts";

describe("TrackedCommand", () => {
  it("starts at its output start, not ended, with no exit code or folder", () => {
    const command: TrackedCommand = new TrackedCommand(10, true);

    assert.equal(command.outputStart, 10);
    assert.equal(command.hasOutputStart, true);
    assert.equal(command.outputEnd, null);
    assert.equal(command.exitCode, null);
    assert.equal(command.cwd, null);
    assert.equal(command.hasEnded, false);
  });

  it("holds its output end, exit code and folder once ended", () => {
    const command: TrackedCommand = new TrackedCommand(10, false);

    command.end(42, 2, "/home/me");

    assert.equal(command.hasOutputStart, false);
    assert.equal(command.outputEnd, 42);
    assert.equal(command.exitCode, 2);
    assert.equal(command.cwd, "/home/me");
    assert.equal(command.hasEnded, true);
  });

  it("has ended with no exit code or folder when the shell gave none", () => {
    const command: TrackedCommand = new TrackedCommand(10, true);

    command.end(10, null, null);

    assert.equal(command.hasEnded, true);
    assert.equal(command.exitCode, null);
    assert.equal(command.cwd, null);
  });
});
