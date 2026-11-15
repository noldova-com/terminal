/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import { type IToolDescriptor, type ToolResult, ToolRisk } from "@noldova/desktop.runtime";
import { ProtocolReader } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";
import type { AgentTerminalAccess } from "../models/agent-terminal-access.ts";
import type { ToolCallContext } from "../models/tool-call-context.ts";
import type { TerminalAccessPolicy } from "./terminal-access-policy.ts";
import { TerminalTool } from "./terminal-tool.ts";
import { ToolResults } from "./tool-results.ts";

export class TerminalListTool extends TerminalTool<null> {
  private readonly accessPolicy: TerminalAccessPolicy;

  public readonly descriptor: IToolDescriptor = {
    name: Resources.listToolName,
    description: Resources.listToolDescription,
    inputSchema: { type: Resources.jsonObjectType, additionalProperties: false, properties: {} },
    outputSchema: {
      type: Resources.jsonObjectType,
      additionalProperties: false,
      required: [Resources.terminalListToolTerminalsField],
      properties: {
        [Resources.terminalListToolTerminalsField]: {
          type: Resources.jsonArrayType,
          items: {
            type: Resources.jsonObjectType,
            additionalProperties: false,
            required: [Resources.terminalIdField, Resources.titleField, Resources.shellField, Resources.cwdField, Resources.terminalListToolIsSharedField,
              Resources.terminalListToolIsRunningField],
            properties: {
              [Resources.terminalIdField]: { type: Resources.jsonStringType },
              [Resources.titleField]: { type: Resources.jsonStringType },
              [Resources.shellField]: { type: Resources.jsonStringType },
              [Resources.cwdField]: { type: [Resources.jsonStringType, Resources.jsonNullType], description: Resources.cwdFieldDescription },
              [Resources.terminalListToolIsSharedField]: { type: Resources.jsonBooleanType, description: Resources.sharedFieldDescription },
              [Resources.terminalListToolIsRunningField]: { type: Resources.jsonBooleanType }
            }
          }
        }
      }
    },
    hints: { isReadOnly: true, isDestructive: false, isOpenWorld: false },
    risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
    isResumable: true,
    marksSending: false,
    deadline: { default: Resources.shortCallMilliseconds, maximum: Resources.shortCallMilliseconds }
  };

  public constructor(accessPolicy: TerminalAccessPolicy) {
    super();

    this.accessPolicy = accessPolicy;
  }

  protected parseInput(input: unknown): null {
    ProtocolReader.fromValue(input).allowOnly([]);
    return null;
  }

  protected async runAsync(_input: null, context: ToolCallContext): Promise<ToolResult> {
    const accesses: readonly AgentTerminalAccess[] = this.accessPolicy.list(context);
    const terminals: readonly JsonObject[] = accesses.map(t => ({
      [Resources.terminalIdField]: t.terminal.id,
      [Resources.titleField]: t.terminal.title,
      [Resources.shellField]: t.terminal.shellId,
      [Resources.cwdField]: t.terminal.readPrompt().cwd,
      [Resources.terminalListToolIsSharedField]: t.isShared,
      [Resources.terminalListToolIsRunningField]: t.terminal.isRunning
    }));
    return ToolResults.create(Resources.formatTerminalList(accesses.map(t => t.terminal.id)), { [Resources.terminalListToolTerminalsField]: terminals }, Resources.terminalListOrigin);
  }
}
