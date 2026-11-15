/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { PermissionDetailKind, ToolRisk } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { PermissionAsk } from "../../../src/tools/models/permission-ask.ts";

describe("PermissionAsk", () => {
  it("builds Noldova Desktop's request with the module's action, the title, the details, the risk and the subject, and keeps the tool's name", () => {
    const ask: PermissionAsk = new PermissionAsk("terminal_read", "read", "Read a terminal's output",
      ToolRisk.Medium, [{ label: "Terminal id", kind: PermissionDetailKind.Code, value: "t1" }], "[\"t1\"]");

    assert.equal(ask.toolName, "terminal_read");
    assert.deepEqual(ask.request, {
      action: "terminal.read",
      subject: "[\"t1\"]",
      title: "Read a terminal's output",
      details: [{ label: "Terminal id", kind: "Code", value: "t1" }],
      risk: "Medium",
      isAsking: true,
      options: ["AllowOnce", "AllowAlways", "Deny"]
    });
  });

  it("offers allow always unless told to offer only allow once and deny", () => {
    assert.deepEqual(new PermissionAsk("a", "a", "A", ToolRisk.High, [], "").request.options, ["AllowOnce", "AllowAlways", "Deny"]);
    assert.deepEqual(new PermissionAsk("a", "a", "A", ToolRisk.High, [], "", PermissionAsk.onceOptions).request.options, ["AllowOnce", "Deny"]);
  });

  it("asks the person for medium and high risk, and lets the app's policy answer low risk", () => {
    assert.deepEqual([ToolRisk.Low, ToolRisk.Medium, ToolRisk.High].map(t => new PermissionAsk("a", "a", "A", t, [], "").request.isAsking), [false, true, true]);
  });

  it("keeps a subject of ids as JSON, and one with exact text as the hex SHA-256 of its JSON, so it fits and changes with any character", () => {
    assert.equal(PermissionAsk.listSubject(["t1", null]), "[\"t1\",null]");
    assert.equal(PermissionAsk.hashSubject(["t1", "/work", "ls"]), "sha256:38744196e1d0f513688378c1ab4295d4ffa659cac92692e9f7336a79fcfcd1e6");
    assert.equal(PermissionAsk.hashSubject(["t1", "/work", "ls "]), "sha256:084e887890d03591277f39441fdeb57307ac161ffa0bec4c48e7e9e5361bb5a1");
    assert.equal(PermissionAsk.hashSubject(["t1", "/work", "x".repeat(16_384)]).length, 71);
  });
});
