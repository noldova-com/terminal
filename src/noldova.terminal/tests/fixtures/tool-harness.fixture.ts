/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import type { JsonObject } from "@noldova/context.json";
import { type ToolCall, type ToolFailure, type ToolFailureCode, ToolFailureException, type ToolResult } from "@noldova/desktop.runtime";

import { ReadCursors } from "../../src/tools/models/read-cursors.ts";
import { PermissionGate } from "../../src/tools/services/permission-gate.ts";
import { TerminalAccessPolicy } from "../../src/tools/services/terminal-access-policy.ts";
import { FakeAgentTerminals } from "./fake-agent-terminals.fixture.ts";
import { FakePermissionRequests } from "./fake-permission-requests.fixture.ts";
import { createCall, SESSION_ID } from "./tool-call-contexts.fixture.ts";

export class ToolHarness {
  public readonly terminals: FakeAgentTerminals = new FakeAgentTerminals();
  public readonly permissions: FakePermissionRequests = new FakePermissionRequests();
  public readonly accessPolicy: TerminalAccessPolicy = new TerminalAccessPolicy(this.terminals);
  public readonly gate: PermissionGate = new PermissionGate();
  public readonly cursors: ReadCursors = new ReadCursors();

  public createCall(input: JsonObject = {}, signal?: AbortSignal, boundTerminalIds?: readonly string[], session: string = SESSION_ID): ToolCall {
    return createCall(input, signal, boundTerminalIds, session, this.permissions);
  }

  public static async assertFailsAsync(call: Promise<unknown>, code: ToolFailureCode, moduleCode: string | null): Promise<ToolFailure> {
    try {
      await call;
    }
    catch (error: unknown) {
      assert.ok(error instanceof ToolFailureException);
      assert.deepEqual([error.failure.code, error.failure.moduleCode], [code, moduleCode]);
      return error.failure;
    }
    assert.fail("The call did not fail.");
  }

  public static assertThrowsFailure(action: () => unknown, code: ToolFailureCode, moduleCode: string | null): ToolFailure {
    try {
      action();
    }
    catch (error: unknown) {
      assert.ok(error instanceof ToolFailureException);
      assert.deepEqual([error.failure.code, error.failure.moduleCode], [code, moduleCode]);
      return error.failure;
    }
    assert.fail("The action did not fail.");
  }

  public static textOf(answer: ToolResult | ToolFailure): string {
    return answer.content.map(t => t.value).join("");
  }

  public static originOf(answer: ToolResult | ToolFailure): string | null {
    return answer.content[0]?.origin ?? null;
  }
}
