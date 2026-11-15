/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import type { ToolResult } from "@noldova/desktop.runtime";

import { Resources } from "../../resources.ts";
import { CommandStatus } from "../enums/command-status.ts";
import { RunMethod } from "../enums/run-method.ts";
import type { IAgentCommand } from "../interfaces/i-agent-command.ts";
import { ToolResults } from "../services/tool-results.ts";
import type { AgentTerminalAccess } from "./agent-terminal-access.ts";
import type { OutputExcerpt } from "./output-excerpt.ts";

export class TerminalOutputReport {
  public static readonly outputSchema: JsonObject = {
    type: Resources.jsonObjectType,
    additionalProperties: false,
    required: [
      Resources.terminalIdField, Resources.titleField, Resources.terminalOutputReportMethodField, Resources.terminalOutputReportStatusField,
      Resources.terminalOutputReportExitCodeField, Resources.cwdField, Resources.terminalOutputReportOutputField,
      Resources.terminalOutputReportOmittedCharactersField, Resources.terminalOutputReportLogFileField, Resources.terminalOutputReportIsAwaitingSecretField
    ],
    properties: {
      [Resources.terminalIdField]: { type: Resources.jsonStringType },
      [Resources.titleField]: { type: Resources.jsonStringType },
      [Resources.terminalOutputReportMethodField]: { type: [Resources.jsonStringType, Resources.jsonNullType], enum: [...Object.values(RunMethod), null], description: Resources.methodFieldDescription },
      [Resources.terminalOutputReportStatusField]: { type: [Resources.jsonStringType, Resources.jsonNullType], enum: [...Object.values(CommandStatus), null], description: Resources.statusFieldDescription },
      [Resources.terminalOutputReportExitCodeField]: { type: [Resources.jsonIntegerType, Resources.jsonNullType] },
      [Resources.cwdField]: { type: [Resources.jsonStringType, Resources.jsonNullType], description: Resources.cwdFieldDescription },
      [Resources.terminalOutputReportOutputField]: { type: Resources.jsonStringType, description: Resources.outputFieldDescription },
      [Resources.terminalOutputReportOmittedCharactersField]: { type: Resources.jsonIntegerType, minimum: 0 },
      [Resources.terminalOutputReportLogFileField]: { type: [Resources.jsonStringType, Resources.jsonNullType], description: Resources.logFileFieldDescription },
      [Resources.terminalOutputReportIsAwaitingSecretField]: { type: Resources.jsonBooleanType, description: Resources.awaitingSecretFieldDescription }
    }
  };

  public readonly access: AgentTerminalAccess;
  public readonly command: IAgentCommand | null;
  public readonly excerpt: OutputExcerpt;
  public readonly cwd: string | null;

  public constructor(access: AgentTerminalAccess, command: IAgentCommand | null, excerpt: OutputExcerpt, cwd: string | null) {
    this.access = access;
    this.command = command;
    this.excerpt = excerpt;
    this.cwd = cwd;
  }

  public toResult(note: string = ""): ToolResult {
    const status: CommandStatus | null = this.command === null ? null : this.command.status;
    const exitCode: number | null = this.command === null ? null : this.command.exitCode;
    const isAwaitingSecret: boolean = this.access.terminal.isAwaitingSecret;
    return ToolResults.create(
      this.excerpt.text + Resources.formatCommandSummary(status, exitCode, this.cwd, isAwaitingSecret) + note,
      {
        [Resources.terminalIdField]: this.access.terminal.id,
        [Resources.titleField]: this.access.terminal.title,
        [Resources.terminalOutputReportMethodField]: this.command === null ? null : this.command.method,
        [Resources.terminalOutputReportStatusField]: status,
        [Resources.terminalOutputReportExitCodeField]: exitCode,
        [Resources.cwdField]: this.cwd,
        [Resources.terminalOutputReportOutputField]: this.excerpt.text,
        [Resources.terminalOutputReportOmittedCharactersField]: this.excerpt.omittedCharacters,
        [Resources.terminalOutputReportLogFileField]: this.command === null ? null : this.command.logFile,
        [Resources.terminalOutputReportIsAwaitingSecretField]: isAwaitingSecret
      },
      this.access.origin);
  }
}
