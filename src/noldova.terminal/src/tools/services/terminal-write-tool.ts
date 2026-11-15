/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IToolDescriptor, ToolFailureCode, type ToolResult, ToolRisk } from "@noldova/desktop.runtime";

import { Resources } from "../../resources.ts";
import type { ITerminalPrompt } from "../interfaces/i-terminal-prompt.ts";
import type { AgentTerminalAccess } from "../models/agent-terminal-access.ts";
import { PermissionAsk } from "../models/permission-ask.ts";
import { TerminalWriteInput } from "../models/terminal-write-input.ts";
import type { ToolCallContext } from "../models/tool-call-context.ts";
import { PermissionDetails } from "./permission-details.ts";
import type { PermissionGate } from "./permission-gate.ts";
import type { TerminalAccessPolicy } from "./terminal-access-policy.ts";
import { TerminalTool } from "./terminal-tool.ts";
import { ToolFailures } from "./tool-failures.ts";
import { ToolResults } from "./tool-results.ts";

export class TerminalWriteTool extends TerminalTool<TerminalWriteInput> {
  private readonly accessPolicy: TerminalAccessPolicy;
  private readonly gate: PermissionGate;

  public readonly descriptor: IToolDescriptor = {
    name: Resources.writeToolName,
    description: Resources.writeToolDescription,
    inputSchema: TerminalWriteInput.schema,
    outputSchema: {
      type: Resources.jsonObjectType,
      additionalProperties: false,
      required: [Resources.terminalIdField, Resources.titleField],
      properties: { [Resources.terminalIdField]: { type: Resources.jsonStringType }, [Resources.titleField]: { type: Resources.jsonStringType } }
    },
    hints: { isReadOnly: false, isDestructive: true, isOpenWorld: true },
    risk: { default: ToolRisk.High, maximum: ToolRisk.High },
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

  protected parseInput(input: unknown): TerminalWriteInput {
    return TerminalWriteInput.fromJson(input);
  }

  protected async runAsync(input: TerminalWriteInput, context: ToolCallContext): Promise<ToolResult> {
    const access: AgentTerminalAccess = this.accessPolicy.resolve(input.terminalId, context);
    access.requireRunning();
    TerminalWriteTool.refuseSecret(access);
    TerminalWriteTool.refusePendingLine(access);
    const prompt: ITerminalPrompt = access.terminal.readPrompt();
    await this.gate.requireGrantAsync(TerminalWriteTool.askFor(input, access, prompt, context), context);
    this.accessPolicy.requireStill(access, context);
    TerminalTool.actOnGrantedState(input.terminalId, context, () => access.terminal.write(input.keys.text, prompt));
    return ToolResults.create(Resources.formatKeysSent(input.terminalId), { [Resources.terminalIdField]: input.terminalId, [Resources.titleField]: access.terminal.title }, access.origin);
  }

  private static refuseSecret(access: AgentTerminalAccess): void {
    if (access.terminal.isAwaitingSecret)
      throw ToolFailures.create(ToolFailureCode.Refused, Resources.awaitingSecretCode, Resources.formatAwaitingSecret(access.terminal.id));
  }

  private static refusePendingLine(access: AgentTerminalAccess): void {
    if (access.terminal.hasPendingLine)
      throw ToolFailures.create(ToolFailureCode.Unavailable, Resources.lineInUseCode, Resources.formatLineInUse(access.terminal.id));
  }

  private static askFor(input: TerminalWriteInput, access: AgentTerminalAccess, prompt: ITerminalPrompt, context: ToolCallContext): PermissionAsk {
    return new PermissionAsk(
      Resources.writeToolName,
      Resources.writeAction,
      Resources.writeTitle,
      ToolRisk.High,
      [
        ...PermissionDetails.forTerminal(access),
        ...PermissionDetails.forShell(access),
        ...PermissionDetails.forFolder(prompt.cwd, prompt.cwd !== null && context.isInsideWorkingFolder(prompt.cwd)),
        PermissionDetails.yesNo(Resources.atPromptLabel, prompt.isIdle),
        PermissionDetails.code(Resources.keysLabel, input.keys.display),
        PermissionDetails.yesNo(Resources.hiddenCharactersLabel, input.keys.hasHiddenCharacters),
        ...PermissionDetails.forExplanation(input.explanation)
      ],
      PermissionAsk.hashSubject([access.terminal.id, prompt.cwd, input.keys.text]),
      PermissionAsk.onceOptions);
  }
}
