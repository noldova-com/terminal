/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalMissingCommands } from "../../src/models/terminal-missing-commands.ts";

describe("TerminalMissingCommands", () => {
  it("writes and reads its wire form", () => {
    const json: object = { names: ["gti"] };

    assert.deepEqual(TerminalMissingCommands.fromJson(json).names, ["gti"]);
    assert.deepEqual(TerminalMissingCommands.fromJson(json).toJson(), json);
    assert.deepEqual(new TerminalMissingCommands([]).toJson(), { names: [] });
  });

  it("refuses a blank name and a 65th name", () => {
    assert.throws(() => new TerminalMissingCommands([" "]), { name: "ArgumentException", parameterName: "names" });
    assert.throws(() => new TerminalMissingCommands(Array.from({ length: 65 }, () => "ls")), { name: "ArgumentException", parameterName: "names" });
  });

  it("names the field it cannot read", () => {
    assert.throws(() => TerminalMissingCommands.fromJson({ names: [""] }), { name: "JsonException", path: "$.names.0" });
    assert.throws(() => TerminalMissingCommands.fromJson({}), { name: "JsonException", path: "$.names" });
    assert.throws(() => TerminalMissingCommands.fromJson({ names: [], extra: 1 }), { name: "JsonException" });
  });

  it("keeps its own copy of the names", () => {
    const names: string[] = ["git"];
    const missing: TerminalMissingCommands = new TerminalMissingCommands(names);
    names.push("npm");

    assert.deepEqual(missing.names, ["git"]);
  });
});
