/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { join } from "node:path";

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, type JsonObject } from "@noldova/context.json";
import { ToolCall } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { ToolCallContext } from "../../../src/tools/models/tool-call-context.ts";
import { SCOPE } from "../../fixtures/tool-call-contexts.fixture.ts";

function createCall(bindings: JsonObject, signal: AbortSignal = new AbortController().signal): ToolCall {
  return new ToolCall("session-1", SCOPE, bindings, {}, Date.now() + 1_000, signal);
}

describe("ToolCallContext", () => {
  const signal: AbortSignal = new AbortController().signal;
  const context: ToolCallContext = new ToolCallContext(createCall({ "terminal.folder": "/work/project", "terminal.shared": ["shared-1"] }, signal));

  it("keeps the call's session and signal, and the folder and terminals bound to its session", () => {
    assert.equal(context.agentSessionId, "session-1");
    assert.equal(context.workingFolder, "/work/project");
    assert.deepEqual(context.boundTerminalIds, ["shared-1"]);
    assert.equal(context.signal, signal);
  });

  it("reads the owner bound to its session, or none when none is bound", () => {
    assert.equal(new ToolCallContext(createCall({ "terminal.folder": "/work", "terminal.owner": "example.chat/42" })).owner, "example.chat/42");
    assert.equal(context.owner, null);
  });

  it("refuses an owner that isn't a string, is blank or is longer than 256 code units", () => {
    assert.throws(() => new ToolCallContext(createCall({ "terminal.folder": "/work", "terminal.owner": 42 })), JsonException);
    assert.throws(() => new ToolCallContext(createCall({ "terminal.folder": "/work", "terminal.owner": " " })), {
      name: "ArgumentException",
      parameterName: "terminal.owner"
    });
    assert.throws(() => new ToolCallContext(createCall({ "terminal.folder": "/work", "terminal.owner": "o".repeat(257) })), JsonException);
    assert.equal(new ToolCallContext(createCall({ "terminal.folder": "/work", "terminal.owner": "o".repeat(256) })).owner?.length, 256);
  });

  it("reads no shared terminals when none are bound", () => {
    assert.deepEqual(new ToolCallContext(createCall({ "terminal.folder": "/work" })).boundTerminalIds, []);
  });

  it("marks sending on the call once the tool is about to send input", () => {
    const call: ToolCall = createCall({ "terminal.folder": "/work" });
    const sending: ToolCallContext = new ToolCallContext(call);

    assert.equal(sending.hasMarkedSending, false);
    sending.markSending();
    sending.markSending();

    assert.deepEqual([sending.hasMarkedSending, call.hasMarkedSending], [true, true]);
  });

  it("tells a bound terminal from another", () => {
    assert.equal(context.isBound("shared-1"), true);
    assert.equal(context.isBound("shared-2"), false);
  });

  it("tells a folder inside the working folder from one outside it", () => {
    assert.equal(context.isInsideWorkingFolder("/work/project"), true);
    assert.equal(context.isInsideWorkingFolder(join("/work/project", "src")), true);
    assert.equal(context.isInsideWorkingFolder(join("/work/project", "..project-old")), true);
    assert.equal(context.isInsideWorkingFolder("/work"), false);
    assert.equal(context.isInsideWorkingFolder("/work/project-old"), false);
    assert.equal(context.isInsideWorkingFolder(join("/work/project", "..", "other")), false);
  });

  it("refuses a missing, blank or relative working folder", () => {
    assert.throws(() => new ToolCallContext(createCall({})), JsonException);
    assert.throws(() => new ToolCallContext(createCall({ "terminal.folder": " " })), JsonException);
    assert.throws(() => new ToolCallContext(createCall({ "terminal.folder": "project" })), {
      name: "ArgumentException",
      message: /terminal\.folder/u
    });
  });

  it("refuses shared terminals that aren't a list of ids", () => {
    const message: string = "The value must be a list of terminal ids. (Parameter 'terminal.shared')";

    assert.throws(() => new ToolCallContext(createCall({ "terminal.folder": "/work", "terminal.shared": "shared-1" })), { name: "ArgumentException", message });
    assert.throws(() => new ToolCallContext(createCall({ "terminal.folder": "/work", "terminal.shared": [1] })), { name: "ArgumentException", message });
    assert.throws(() => new ToolCallContext(createCall({ "terminal.folder": "/work", "terminal.shared": [""] })), ArgumentException);
  });
});
