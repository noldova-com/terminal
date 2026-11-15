/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { type IToolDescriptor, ToolCall, type ToolFailure, ToolFailureCode, type ToolResult, ToolRisk } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { StaleTerminalException } from "../../../src/tools/exceptions/stale-terminal.exception.ts";
import type { ToolCallContext } from "../../../src/tools/models/tool-call-context.ts";
import { TerminalTool } from "../../../src/tools/services/terminal-tool.ts";
import { ToolResults } from "../../../src/tools/services/tool-results.ts";
import { createCall, createContext, SCOPE } from "../../fixtures/tool-call-contexts.fixture.ts";
import { ToolHarness } from "../../fixtures/tool-harness.fixture.ts";

class EchoTool extends TerminalTool<string> {
  public readonly descriptor: IToolDescriptor = {
    name: "terminal_echo",
    description: "Echoes its input.",
    inputSchema: { type: "object" },
    risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
    deadline: { default: 1, maximum: 1 },
    hints: { isReadOnly: true }
  };

  public static act<TResult>(context: ToolCallContext, action: () => TResult): TResult {
    return TerminalTool.actOnGrantedState("t1", context, action);
  }

  protected parseInput(input: unknown): string {
    const text: unknown = new Map<string, unknown>(Object.entries(input as object)).get("text");
    if (text === "protocol")
      throw new JsonException("Expected a string.", "$.text");
    if (text === "argument")
      throw new ArgumentException("The value must not be blank.", "text");
    if (text === "bug")
      throw new TypeError("A bug.");
    return String(text);
  }

  protected async runAsync(input: string, context: ToolCallContext): Promise<ToolResult> {
    return ToolResults.create(`${input} for ${context.agentSessionId} in ${context.workingFolder}`, {}, null);
  }
}

describe("TerminalTool", () => {
  it("runs a call with its parsed input and its session's bindings", async () => {
    const result: ToolResult = await new EchoTool().handleAsync(createCall({ text: "hello" }));

    assert.equal(ToolHarness.textOf(result), "hello for session-1 in /work/project");
    assert.equal(ToolHarness.originOf(result), null);
  });

  for (const [text, message] of [["protocol", "$.text: Expected a string."], ["argument", "The value must not be blank. (Parameter 'text')"]] as const) {
    it(`refuses a ${text} input error as invalid input`, async () => {
      const failure: ToolFailure = await ToolHarness.assertFailsAsync(new EchoTool().handleAsync(createCall({ text })), ToolFailureCode.Refused, "terminal.invalidInput");

      assert.equal(failure.message, message);
    });
  }

  it("refuses a call whose bindings it can't read, before it runs", async () => {
    const call: ToolCall = new ToolCall("session-1", SCOPE, { "terminal.folder": "work" }, { text: "hello" }, Date.now() + 1_000, new AbortController().signal);

    await ToolHarness.assertFailsAsync(new EchoTool().handleAsync(call), ToolFailureCode.Refused, "terminal.invalidBinding");
  });

  it("lets any other error through unchanged", async () => {
    await assert.rejects(new EchoTool().handleAsync(createCall({ text: "bug" })), { name: "TypeError", message: "A bug." });
  });

  it("marks sending, then returns what an action on the granted state returns", () => {
    const context: ToolCallContext = createContext();

    assert.equal(EchoTool.act(context, () => context.hasMarkedSending ? 7 : 0), 7);
  });

  it("fails as stale when the runtime finds the state changed since the grant", async () => {
    const failure: ToolFailure = await ToolHarness.assertFailsAsync(Promise.resolve().then(() => EchoTool.act(createContext(), () => {
      throw new StaleTerminalException("t1");
    })), ToolFailureCode.Stale, "terminal.stale");

    assert.equal(failure.message, "Terminal t1 changed after the person allowed the action, so nothing was sent.");
  });

  it("lets other errors of the action through unchanged", () => {
    assert.throws(() => EchoTool.act(createContext(), () => {
      throw new RangeError("A bug.");
    }), { name: "RangeError" });
  });
});
