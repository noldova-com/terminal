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

import { TerminalOpenParams } from "../../src/models/terminal-open-params.ts";
import { TerminalSize } from "../../src/models/terminal-size.ts";

describe("TerminalOpenParams", () => {
  it("writes and reads its wire form", () => {
    const json: object = { shellId: "bash", folder: "/work/project", size: { cols: 100, rows: 40 }, storedLimit: 20_971_520, isPanelTerminal: true,
      owner: null };
    const params: TerminalOpenParams = TerminalOpenParams.fromJson(json);

    assert.equal(params.shellId, "bash");
    assert.equal(params.folder, "/work/project");
    assert.equal(params.size.columns, 100);
    assert.equal(params.storedLimit, 20_971_520);
    assert.equal(params.isPanelTerminal, true);
    assert.deepEqual(new TerminalOpenParams("bash", "/work/project", new TerminalSize(100, 40), 20_971_520, true).toJson(), json);
  });

  it("leaves the shell and the folder to the runtime when they are null, stores 100 MiB and opens a tab's terminal unless told otherwise", () => {
    const json: object = { shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, isPanelTerminal: false, owner: null };
    const params: TerminalOpenParams = TerminalOpenParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 });

    assert.equal(params.shellId, null);
    assert.equal(params.folder, null);
    assert.equal(params.isPanelTerminal, false);
    assert.equal(params.owner, null);
    assert.deepEqual(params.toJson(), json);
    assert.deepEqual(new TerminalOpenParams(null, null, new TerminalSize(80, 24)).toJson(), json);
  });

  it("ties a tab's terminal to an owner", () => {
    const json: object = { shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, isPanelTerminal: false,
      owner: "example.chat/42" };

    assert.equal(TerminalOpenParams.fromJson(json).owner, "example.chat/42");
    assert.deepEqual(new TerminalOpenParams(null, null, new TerminalSize(80, 24), 104_857_600, false, "example.chat/42").toJson(), json);
    assert.equal(new TerminalOpenParams(null, null, new TerminalSize(80, 24), 104_857_600, false, "o".repeat(256)).owner?.length, 256);
  });

  it("refuses a blank or over-long owner, and an owner for a panel terminal", () => {
    for (const owner of ["", " ", "o".repeat(257)])
      assert.throws(() => new TerminalOpenParams(null, null, new TerminalSize(80, 24), 104_857_600, false, owner),
        { name: "ArgumentException", parameterName: "owner" });
    assert.throws(() => new TerminalOpenParams(null, null, new TerminalSize(80, 24), 104_857_600, true, "example.chat/42"),
      { name: "ArgumentException", parameterName: "owner", message: "A panel terminal has no owner. (Parameter 'owner')" });
    assert.throws(
      () => TerminalOpenParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, owner: 42 }),
      { name: "JsonException", path: "$.owner" });
  });

  it("refuses a blank shell or folder", () => {
    assert.throws(() => new TerminalOpenParams(" ", null, new TerminalSize(80, 24)), ArgumentException);
    assert.throws(() => new TerminalOpenParams("bash", "", new TerminalSize(80, 24)), ArgumentException);
  });

  it("refuses a relative folder, naming the field when it reads one", () => {
    assert.throws(() => new TerminalOpenParams(null, "work", new TerminalSize(80, 24)), { name: "ArgumentException", parameterName: "folder" });
    assert.throws(() => TerminalOpenParams.fromJson({ shellId: null, folder: "work", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 }),
      { name: "JsonException", path: "$.folder", message: "$.folder: The value must be an absolute path. (Parameter 'folder')" });
  });

  it("refuses a blank owner, and an owner for a panel terminal, at the owner's field when it reads them", () => {
    const json: object = { shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 };

    assert.throws(() => TerminalOpenParams.fromJson({ ...json, owner: " " }), { name: "JsonException", path: "$.owner" });
    assert.throws(() => TerminalOpenParams.fromJson({ ...json, isPanelTerminal: true, owner: "example.chat/42" }),
      { name: "JsonException", path: "$.owner", message: "$.owner: A panel terminal has no owner. (Parameter 'owner')" });
  });

  it("stores from 10 MiB to 10,000 MiB", () => {
    for (const limit of [10_485_760, 10_485_760_000])
      assert.equal(new TerminalOpenParams(null, null, new TerminalSize(80, 24), limit).storedLimit, limit);
    for (const limit of [10_485_759, 10_485_760_001, 10_485_760.5])
      assert.throws(() => new TerminalOpenParams(null, null, new TerminalSize(80, 24), limit), { name: "ArgumentOutOfRangeException", parameterName: "storedLimit" });
    assert.throws(
      () => TerminalOpenParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 1 }),
      { name: "JsonException", path: "$.storedLimit" });
  });

  it("names the nested field it cannot read", () => {
    assert.throws(
      () => TerminalOpenParams.fromJson({ shellId: "bash", folder: "/", size: { cols: 80 }, storedLimit: 104_857_600 }),
      { name: "JsonException", path: "$.size.rows" });
  });
});
