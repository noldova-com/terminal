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
import { TerminalExited } from "../../src/models/terminal-exited.ts";

describe("TerminalExited", () => {
  it("writes and reads its wire form", () => {
    const json: object = { sessionId: "s1", exit: { exitCode: 130, endedBy: "Exit" } };

    assert.equal(TerminalExited.fromJson(json).exit.exitCode, 130);
    assert.deepEqual(new TerminalExited("s1", new TerminalExit(130, EndedBy.Exit)).toJson(), json);
  });

  it("refuses a missing exit", () => {
    assert.throws(() => new TerminalExited(" ", new TerminalExit(0, EndedBy.Exit)), ArgumentException);
    assert.throws(() => TerminalExited.fromJson({ sessionId: "s1" }), { name: "JsonException", path: "$.exit" });
  });
});
