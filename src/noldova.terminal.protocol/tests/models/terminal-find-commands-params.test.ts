/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalFindCommandsParams } from "../../src/models/terminal-find-commands-params.ts";

describe("TerminalFindCommandsParams", () => {
  it("writes and reads its wire form", () => {
    const json: object = { sessionId: "s1", names: ["git", "gti"] };
    const params: TerminalFindCommandsParams = TerminalFindCommandsParams.fromJson(json);

    assert.deepEqual([params.sessionId, params.names], ["s1", ["git", "gti"]]);
    assert.deepEqual(params.toJson(), json);
  });

  it("takes no names, and 64 names", () => {
    assert.deepEqual(new TerminalFindCommandsParams("s1", []).names, []);
    assert.equal(new TerminalFindCommandsParams("s1", Array.from({ length: 64 }, () => "ls")).names.length, 64);
  });

  it("refuses a blank session, a blank name and a 65th name", () => {
    assert.throws(() => new TerminalFindCommandsParams(" ", ["ls"]), { name: "ArgumentException", parameterName: "sessionId" });
    assert.throws(() => new TerminalFindCommandsParams("s1", [""]), { name: "ArgumentException", parameterName: "names" });
    assert.throws(() => new TerminalFindCommandsParams("s1", Array.from({ length: 65 }, () => "ls")), { name: "ArgumentException", parameterName: "names" });
  });

  it("names the field it cannot read", () => {
    assert.throws(() => TerminalFindCommandsParams.fromJson({ sessionId: "s1", names: "ls" }), { name: "JsonException", path: "$.names" });
    assert.throws(() => TerminalFindCommandsParams.fromJson({ sessionId: "s1", names: [7] }), { name: "JsonException", path: "$.names.0" });
    assert.throws(() => TerminalFindCommandsParams.fromJson({ sessionId: "s1", names: Array.from({ length: 65 }, () => "ls") }),
      { name: "JsonException", path: "$.names" });
    assert.throws(() => TerminalFindCommandsParams.fromJson({ sessionId: "s1", names: [], shell: "bash" }), { name: "JsonException" });
  });

  it("keeps its own copy of the names", () => {
    const names: string[] = ["git"];
    const params: TerminalFindCommandsParams = new TerminalFindCommandsParams("s1", names);
    names.push("npm");

    assert.deepEqual(params.names, ["git"]);
  });
});
