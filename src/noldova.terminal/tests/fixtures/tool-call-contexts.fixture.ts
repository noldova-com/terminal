/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import { type IToolCallPermissions, ToolCall } from "@noldova/desktop.runtime";

import { ToolCallContext } from "../../src/tools/models/tool-call-context.ts";

export const SESSION_ID: string = "session-1";
export const SCOPE: string = "chats.chat";
export const WORKING_FOLDER: string = "/work/project";

export function createBindings(boundTerminalIds: readonly string[] = []): JsonObject {
  return { "terminal.folder": WORKING_FOLDER, "terminal.shared": [...boundTerminalIds] };
}

export function createCall(input: JsonObject = {}, signal: AbortSignal = new AbortController().signal, boundTerminalIds: readonly string[] = [],
  session: string = SESSION_ID, permissions?: IToolCallPermissions): ToolCall {
  return new ToolCall(session, SCOPE, createBindings(boundTerminalIds), input, Date.now() + 30_000, signal, permissions);
}

export function createOwnedContext(owner: string): ToolCallContext {
  return new ToolCallContext(new ToolCall(SESSION_ID, SCOPE, { ...createBindings(), "terminal.owner": owner }, {}, Date.now() + 30_000,
    new AbortController().signal));
}

export function createContext(signal: AbortSignal = new AbortController().signal, boundTerminalIds: readonly string[] = [],
  permissions?: IToolCallPermissions): ToolCallContext {
  return new ToolCallContext(createCall({}, signal, boundTerminalIds, SESSION_ID, permissions));
}
