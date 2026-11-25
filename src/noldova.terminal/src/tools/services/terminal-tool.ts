/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { type IToolDescriptor, type IToolHandler, type ToolCall, ToolFailureCode, type ToolFailureException, type ToolResult } from "@noldova/desktop.runtime";

import { Resources } from "../../resources.ts";
import { StaleTerminalException } from "../exceptions/stale-terminal.exception.ts";
import type { IAgentCommand } from "../interfaces/i-agent-command.ts";
import type { TerminalOutputReport } from "../models/terminal-output-report.ts";
import { ToolCallContext } from "../models/tool-call-context.ts";
import { AbortReasonReader } from "./abort-reason-reader.ts";
import { ToolFailures } from "./tool-failures.ts";

export abstract class TerminalTool<TInput> implements IToolHandler {
  public abstract readonly descriptor: IToolDescriptor;

  public async handleAsync(call: ToolCall): Promise<ToolResult> {
    const input: TInput = TerminalTool.refuseInvalid(Resources.invalidInputCode, () => this.parseInput(call.arguments));
    return await this.runAsync(input, TerminalTool.refuseInvalid(Resources.invalidBindingCode, () => new ToolCallContext(call)));
  }

  protected abstract parseInput(input: unknown): TInput;

  protected abstract runAsync(input: TInput, context: ToolCallContext): Promise<ToolResult>;

  protected static actOnGrantedState<TResult>(terminalId: string, context: ToolCallContext, action: () => TResult): TResult {
    context.markSending();
    try {
      return action();
    }
    catch (error: unknown) {
      if (error instanceof StaleTerminalException)
        throw ToolFailures.create(ToolFailureCode.Stale, Resources.staleCode, Resources.formatTerminalStale(terminalId));
      throw error;
    }
  }

  protected static failEndedCall(action: string, command: IAgentCommand | null, report: TerminalOutputReport, signal: AbortSignal): ToolFailureException {
    if (!Object.isNull(command) && AbortReasonReader.interruptsCommand(signal) && command.interrupt())
      return ToolFailures.forEndedCall(signal, Resources.formatInterruptedWithOutput(action), report.toResult(Resources.interruptedNote));
    return ToolFailures.forEndedCall(signal, Resources.formatEndedWithOutput(action), report.toResult());
  }

  private static refuseInvalid<TValue>(moduleCode: string, read: () => TValue): TValue {
    try {
      return read();
    }
    catch (error: unknown) {
      if (error instanceof JsonException || error instanceof ArgumentException)
        throw ToolFailures.create(ToolFailureCode.Refused, moduleCode, error.message);
      throw error;
    }
  }
}
