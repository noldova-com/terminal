/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IToolDescriptor, type ToolResult, ToolRisk } from "@noldova/desktop.runtime";

import { Resources } from "../../resources.ts";
import type { AgentTerminalAccess } from "../models/agent-terminal-access.ts";
import { PermissionAsk } from "../models/permission-ask.ts";
import type { ReadCursors } from "../models/read-cursors.ts";
import { TerminalTargetInput } from "../models/terminal-target-input.ts";
import type { ToolCallContext } from "../models/tool-call-context.ts";
import { PermissionDetails } from "./permission-details.ts";
import type { PermissionGate } from "./permission-gate.ts";
import { SignalRace } from "./signal-race.ts";
import type { TerminalAccessPolicy } from "./terminal-access-policy.ts";
import { TerminalTool } from "./terminal-tool.ts";
import { ToolFailures } from "./tool-failures.ts";
import { ToolResults } from "./tool-results.ts";

export class TerminalCloseTool extends TerminalTool<TerminalTargetInput> {
  private readonly accessPolicy: TerminalAccessPolicy;
  private readonly gate: PermissionGate;
  private readonly cursors: ReadCursors;

  public readonly descriptor: IToolDescriptor = {
    name: Resources.closeToolName,
    description: Resources.closeToolDescription,
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
    deadline: { default: Resources.closeCallMilliseconds, maximum: Resources.maximumCallMilliseconds },
    resource: Resources.terminalResourceKey,
    nextTool: Resources.listToolName
  };

  public constructor(accessPolicy: TerminalAccessPolicy, gate: PermissionGate, cursors: ReadCursors) {
    super();

    this.accessPolicy = accessPolicy;
    this.gate = gate;
    this.cursors = cursors;
  }

  protected parseInput(input: unknown): TerminalTargetInput {
    return TerminalTargetInput.fromJson(input);
  }

  protected async runAsync(input: TerminalTargetInput, context: ToolCallContext): Promise<ToolResult> {
    const access: AgentTerminalAccess = this.accessPolicy.resolve(input.terminalId, context);
    await this.gate.requireGrantAsync(
      new PermissionAsk(
        Resources.closeToolName,
        Resources.closeAction,
        Resources.closeTitle,
        ToolRisk.Medium,
        [...PermissionDetails.forTerminal(access), ...PermissionDetails.forExplanation(input.explanation)],
        PermissionAsk.listSubject([access.terminal.id])),
      context);
    this.accessPolicy.requireStill(access, context);
    context.markSending();
    await SignalRace.raceAsync(access.terminal.closeAsync(), context.signal, () =>
      ToolFailures.forUncertainOutcome(Resources.formatCloseOutcomeUncertain(input.terminalId)));
    this.cursors.forgetTerminal(input.terminalId);
    return ToolResults.create(Resources.formatTerminalClosed(input.terminalId), { [Resources.terminalIdField]: input.terminalId }, null);
  }
}
