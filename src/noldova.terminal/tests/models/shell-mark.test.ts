/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { MarkKind } from "../../src/enums/mark-kind.ts";
import { ShellMark } from "../../src/models/shell-mark.ts";

describe("ShellMark", () => {
  it("holds its kind, value, offset and values", () => {
    const mark: ShellMark = new ShellMark(MarkKind.Options, "-a", 12, ["-a", "-l"]);

    assert.equal(mark.kind, MarkKind.Options);
    assert.equal(mark.value, "-a");
    assert.equal(mark.offset, 12);
    assert.deepEqual(mark.values, ["-a", "-l"]);
  });

  it("has its one value as its values by default", () => {
    const mark: ShellMark = new ShellMark(MarkKind.CommandEnd, "0", 40);

    assert.deepEqual(mark.values, ["0"]);
  });

  it("has no values by default when it has no value", () => {
    const mark: ShellMark = new ShellMark(MarkKind.PromptStart, null, 0);

    assert.equal(mark.value, null);
    assert.deepEqual(mark.values, []);
  });
});
