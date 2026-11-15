/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ArgumentException } from "@noldova/context.exceptions";
import { describe, it } from "vitest";

import { EndedBy } from "../../src/enums/ended-by.ts";
import { TerminalExit } from "../../src/models/terminal-exit.ts";

describe("TerminalExit", () => {
  it("writes and reads an exit code", () => {
    const exit: TerminalExit = TerminalExit.fromJson({ exitCode: 3, endedBy: "Exit" });

    assert.equal(exit.exitCode, 3);
    assert.equal(exit.endedBy, EndedBy.Exit);
    assert.deepEqual(new TerminalExit(0, EndedBy.Exit).toJson(), { exitCode: 0, endedBy: "Exit" });
  });

  it("writes and reads an unknown exit code as null", () => {
    assert.equal(TerminalExit.fromJson({ exitCode: null, endedBy: "Close" }).exitCode, null);
    assert.deepEqual(new TerminalExit(null, EndedBy.Close).toJson(), { exitCode: null, endedBy: "Close" });
  });

  it("refuses a fractional exit code", () => {
    assert.throws(() => new TerminalExit(1.5, EndedBy.Exit), ArgumentException);
  });

  it("refuses an unknown ending", () => {
    assert.throws(() => TerminalExit.fromJson({ exitCode: 0, endedBy: "Crash" }), { name: "JsonException", path: "$.endedBy" });
  });

  it("takes exit codes from the lowest signed to the highest unsigned 32-bit number, and refuses one beyond them", () => {
    for (const exitCode of [-2_147_483_648, 4_294_967_295])
      assert.equal(new TerminalExit(exitCode, EndedBy.Exit).exitCode, exitCode);
    for (const exitCode of [-2_147_483_649, 4_294_967_296])
      assert.throws(() => new TerminalExit(exitCode, EndedBy.Exit), { name: "ArgumentOutOfRangeException", parameterName: "exitCode" });
  });
});
