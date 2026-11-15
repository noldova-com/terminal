/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IToolDescriptor, type ToolResult, ToolRisk } from "@noldova/desktop.runtime";

import { Resources } from "../../resources.ts";
import type { IAgentTerminal } from "../interfaces/i-agent-terminal.ts";
import type { IAgentTerminals } from "../interfaces/i-agent-terminals.ts";
import { AgentTerminalOpening } from "../models/agent-terminal-opening.ts";
import { PermissionAsk } from "../models/permission-ask.ts";
import { TerminalOpenInput } from "../models/terminal-open-input.ts";
import type { ToolCallContext } from "../models/tool-call-context.ts";
import { PermissionDetails } from "./permission-details.ts";
import type { PermissionGate } from "./permission-gate.ts";
import { SignalRace } from "./signal-race.ts";
import { TerminalTool } from "./terminal-tool.ts";
import { ToolFailures } from "./tool-failures.ts";
import { ToolResults } from "./tool-results.ts";

export class TerminalOpenTool extends TerminalTool<TerminalOpenInput> {
  private readonly terminals: IAgentTerminals;
  private readonly gate: PermissionGate;

  public readonly descriptor: IToolDescriptor = {
    name: Resources.openToolName,
    description: Resources.openToolDescription,
    inputSchema: TerminalOpenInput.schema,
    outputSchema: {
      type: Resources.jsonObjectType,
      additionalProperties: false,
      required: [Resources.terminalIdField, Resources.titleField, Resources.shellField, Resources.cwdField, Resources.terminalOpenToolHasShellIntegrationField],
      properties: {
        [Resources.terminalIdField]: { type: Resources.jsonStringType },
        [Resources.titleField]: { type: Resources.jsonStringType },
        [Resources.shellField]: { type: Resources.jsonStringType },
        [Resources.cwdField]: { type: Resources.jsonStringType },
        [Resources.terminalOpenToolHasShellIntegrationField]: { type: Resources.jsonBooleanType, description: Resources.integrationFieldDescription }
      }
    },
    hints: { isReadOnly: false, isDestructive: false, isOpenWorld: false },
    risk: { default: ToolRisk.Medium, maximum: ToolRisk.Medium },
    isResumable: false,
    marksSending: true,
    deadline: { default: Resources.openCallMilliseconds, maximum: Resources.maximumCallMilliseconds },
    nextTool: Resources.listToolName
  };

  public constructor(terminals: IAgentTerminals, gate: PermissionGate) {
    super();

    this.terminals = terminals;
    this.gate = gate;
  }

  protected parseInput(input: unknown): TerminalOpenInput {
    return TerminalOpenInput.fromJson(input);
  }

  protected async runAsync(input: TerminalOpenInput, context: ToolCallContext): Promise<ToolResult> {
    await this.gate.requireGrantAsync(TerminalOpenTool.askFor(input, context), context);
    context.markSending();
    const terminal: IAgentTerminal = await SignalRace.raceAsync(
      this.terminals.openAsync(new AgentTerminalOpening(context.agentSessionId, input.shellId, context.workingFolder, context.owner), context.signal),
      context.signal,
      () => ToolFailures.forUncertainOutcome(Resources.openOutcomeUncertainMessage));
    return ToolResults.create(
      Resources.formatTerminalOpened(terminal.id, terminal.shellId, context.workingFolder),
      {
        [Resources.terminalIdField]: terminal.id,
        [Resources.titleField]: terminal.title,
        [Resources.shellField]: terminal.shellId,
        [Resources.cwdField]: context.workingFolder,
        [Resources.terminalOpenToolHasShellIntegrationField]: terminal.hasShellIntegration
      },
      Resources.formatTerminalOrigin(terminal.id));
  }

  private static askFor(input: TerminalOpenInput, context: ToolCallContext): PermissionAsk {
    return new PermissionAsk(
      Resources.openToolName,
      Resources.openAction,
      Resources.openTitle,
      ToolRisk.Medium,
      [
        PermissionDetails.text(Resources.shellLabel, input.shellId ?? Resources.defaultShell),
        ...PermissionDetails.forFolder(context.workingFolder, true),
        ...PermissionDetails.forExplanation(input.explanation)
      ],
      PermissionAsk.listSubject([input.shellId]));
  }
}
