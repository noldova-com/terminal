/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { type IToolDescriptor, ToolFailureCode, type ToolResult, ToolRisk } from "@noldova/desktop.runtime";

import { Resources } from "../../resources.ts";
import type { IAgentCommand } from "../interfaces/i-agent-command.ts";
import type { IAgentTerminal } from "../interfaces/i-agent-terminal.ts";
import type { ITerminalPrompt } from "../interfaces/i-terminal-prompt.ts";
import type { AgentTerminalAccess } from "../models/agent-terminal-access.ts";
import type { CommandLine } from "../models/command-line.ts";
import type { OutputChunk } from "../models/output-chunk.ts";
import { OutputExcerpt } from "../models/output-excerpt.ts";
import { PermissionAsk } from "../models/permission-ask.ts";
import { ReadCursor } from "../models/read-cursor.ts";
import type { ReadCursors } from "../models/read-cursors.ts";
import { TerminalOutputReport } from "../models/terminal-output-report.ts";
import { TerminalRunInput } from "../models/terminal-run-input.ts";
import type { ToolCallContext } from "../models/tool-call-context.ts";
import { PermissionDetails } from "./permission-details.ts";
import type { PermissionGate } from "./permission-gate.ts";
import type { TerminalAccessPolicy } from "./terminal-access-policy.ts";
import { TerminalTextEscaper } from "./terminal-text-escaper.ts";
import { TerminalTool } from "./terminal-tool.ts";
import { ToolFailures } from "./tool-failures.ts";

export class TerminalRunTool extends TerminalTool<TerminalRunInput> {
  private readonly accessPolicy: TerminalAccessPolicy;
  private readonly gate: PermissionGate;
  private readonly cursors: ReadCursors;

  public readonly descriptor: IToolDescriptor = {
    name: Resources.runToolName,
    description: Resources.runToolDescription,
    inputSchema: TerminalRunInput.schema,
    outputSchema: TerminalOutputReport.outputSchema,
    hints: { isReadOnly: false, isDestructive: true, isOpenWorld: true },
    risk: { default: ToolRisk.High, maximum: ToolRisk.High },
    isResumable: true,
    marksSending: true,
    deadline: { default: Resources.defaultYieldMilliseconds, maximum: Resources.maximumCallMilliseconds },
    resource: Resources.terminalResourceKey
  };

  public constructor(accessPolicy: TerminalAccessPolicy, gate: PermissionGate, cursors: ReadCursors) {
    super();

    this.accessPolicy = accessPolicy;
    this.gate = gate;
    this.cursors = cursors;
  }

  protected parseInput(input: unknown): TerminalRunInput {
    return TerminalRunInput.fromJson(input);
  }

  protected async runAsync(input: TerminalRunInput, context: ToolCallContext): Promise<ToolResult> {
    const access: AgentTerminalAccess = this.accessPolicy.resolve(input.terminalId, context);
    access.requireRunning();
    const prompt: ITerminalPrompt = access.terminal.readPrompt();
    if (!prompt.isIdle)
      throw ToolFailures.create(ToolFailureCode.Unavailable, Resources.notIdleCode, Resources.formatTerminalNotIdle(input.terminalId));
    await this.gate.requireGrantAsync(TerminalRunTool.askFor(input, access, prompt, context), context);
    this.accessPolicy.requireStill(access, context);
    const command: IAgentCommand = TerminalTool.actOnGrantedState(input.terminalId, context, () => access.terminal.run(input.command.text, prompt, input.timeoutMilliseconds));
    await command.waitForEndAsync(input.yieldMilliseconds, context.signal);
    const chunk: OutputChunk = command.readSince(0);
    this.cursors.set(context.agentSessionId, input.terminalId, ReadCursor.forCommand(command, context.signal.aborted ? 0 : chunk.endOffset));
    const report: TerminalOutputReport = new TerminalOutputReport(access, command, OutputExcerpt.of(chunk, input.maximumCharacters), command.cwd);
    if (context.signal.aborted)
      throw TerminalTool.failEndedCall(Resources.runToolName, command, report, context.signal);
    return report.toResult();
  }

  private static readOneShotLine(terminal: IAgentTerminal, command: CommandLine): string | null {
    const line: string | null = terminal.readOneShotLine(command.text);
    return Object.isNull(line) ? null : TerminalTextEscaper.escapeHidden(line);
  }

  private static askFor(input: TerminalRunInput, access: AgentTerminalAccess, prompt: ITerminalPrompt, context: ToolCallContext): PermissionAsk {
    const oneShotLine: string | null = TerminalRunTool.readOneShotLine(access.terminal, input.command);
    const folder: string | null = Object.isNull(oneShotLine) ? prompt.cwd : access.terminal.startFolder;
    return new PermissionAsk(
      Resources.runToolName,
      Resources.runAction,
      Resources.runTitle,
      ToolRisk.High,
      [
        ...PermissionDetails.forTerminal(access),
        ...PermissionDetails.forShell(access),
        ...PermissionDetails.forFolder(folder, !Object.isNull(folder) && context.isInsideWorkingFolder(folder)),
        PermissionDetails.code(Resources.commandLabel, input.command.display),
        PermissionDetails.yesNo(Resources.hiddenCharactersLabel, input.command.hasHiddenCharacters),
        Object.isNull(oneShotLine) ? PermissionDetails.text(Resources.methodLabel, Resources.inShellMethod) : PermissionDetails.code(Resources.oneShotLineLabel, oneShotLine),
        ...PermissionDetails.forExplanation(input.explanation)
      ],
      PermissionAsk.hashSubject([access.terminal.id, folder, input.command.text]));
  }
}
