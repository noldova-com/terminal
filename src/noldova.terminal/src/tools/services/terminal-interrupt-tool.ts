/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { type IToolDescriptor, type ToolResult, ToolRisk } from "@noldova/desktop.runtime";

import { Resources } from "../../resources.ts";
import type { ITerminalPrompt } from "../interfaces/i-terminal-prompt.ts";
import type { AgentTerminalAccess } from "../models/agent-terminal-access.ts";
import { PermissionAsk } from "../models/permission-ask.ts";
import { TerminalTargetInput } from "../models/terminal-target-input.ts";
import type { ToolCallContext } from "../models/tool-call-context.ts";
import { PermissionDetails } from "./permission-details.ts";
import type { PermissionGate } from "./permission-gate.ts";
import type { TerminalAccessPolicy } from "./terminal-access-policy.ts";
import { TerminalTool } from "./terminal-tool.ts";
import { ToolResults } from "./tool-results.ts";

export class TerminalInterruptTool extends TerminalTool<TerminalTargetInput> {
  private readonly accessPolicy: TerminalAccessPolicy;
  private readonly gate: PermissionGate;

  public readonly descriptor: IToolDescriptor = {
    name: Resources.interruptToolName,
    description: Resources.interruptToolDescription,
    inputSchema: TerminalTargetInput.schema,
    outputSchema: {
      type: Resources.jsonObjectType,
      additionalProperties: false,
      required: [Resources.terminalIdField],
      properties: { [Resources.terminalIdField]: { type: Resources.jsonStringType } }
    },
    hints: { isReadOnly: false, isDestructive: true, isOpenWorld: false },
    risk: { default: ToolRisk.Medium, maximum: ToolRisk.Medium },
    isResumable: false,
    marksSending: true,
    deadline: { default: Resources.shortCallMilliseconds, maximum: Resources.shortCallMilliseconds },
    resource: Resources.terminalResourceKey,
    nextTool: Resources.readToolName
  };

  public constructor(accessPolicy: TerminalAccessPolicy, gate: PermissionGate) {
    super();

    this.accessPolicy = accessPolicy;
    this.gate = gate;
  }

  protected parseInput(input: unknown): TerminalTargetInput {
    return TerminalTargetInput.fromJson(input);
  }

  protected async runAsync(input: TerminalTargetInput, context: ToolCallContext): Promise<ToolResult> {
    const access: AgentTerminalAccess = this.accessPolicy.resolve(input.terminalId, context);
    access.requireRunning();
    const prompt: ITerminalPrompt = access.terminal.readPrompt();
    await this.gate.requireGrantAsync(
      new PermissionAsk(
        Resources.interruptToolName,
        Resources.interruptAction,
        Resources.interruptTitle,
        ToolRisk.Medium,
        [
          ...PermissionDetails.forTerminal(access),
          ...PermissionDetails.forFolder(prompt.cwd, !Object.isNull(prompt.cwd) && context.isInsideWorkingFolder(prompt.cwd)),
          ...PermissionDetails.forExplanation(input.explanation)
        ],
        PermissionAsk.listSubject([access.terminal.id])),
      context);
    this.accessPolicy.requireStill(access, context);
    TerminalTool.actOnGrantedState(input.terminalId, context, () => access.terminal.interrupt(prompt));
    return ToolResults.create(Resources.formatInterruptSent(input.terminalId), { [Resources.terminalIdField]: input.terminalId }, null);
  }
}
