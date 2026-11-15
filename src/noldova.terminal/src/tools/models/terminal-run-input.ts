/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import { ArgumentValidator, ProtocolReader, Resources as ProtocolResources } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";
import { CommandLine } from "./command-line.ts";

export class TerminalRunInput {
  public static readonly schema: JsonObject = {
    type: Resources.jsonObjectType,
    additionalProperties: false,
    required: [Resources.terminalIdField, Resources.commandField],
    properties: {
      [Resources.terminalIdField]: { type: Resources.jsonStringType, minLength: 1, description: Resources.terminalIdFieldDescription },
      [Resources.commandField]: { type: Resources.jsonStringType, minLength: 1, description: Resources.commandFieldDescription },
      [Resources.explanationField]: { type: Resources.jsonStringType, maxLength: Resources.maximumExplanationLength, description: Resources.explanationFieldDescription },
      [Resources.terminalRunInputYieldMsField]: { type: Resources.jsonIntegerType, minimum: 0, default: Resources.defaultYieldMilliseconds, description: Resources.yieldFieldDescription },
      [Resources.terminalRunInputTimeoutMsField]: { type: Resources.jsonIntegerType, minimum: 0, default: 0, description: Resources.timeoutFieldDescription },
      [Resources.maxCharsField]: { type: Resources.jsonIntegerType, minimum: 1, default: Resources.maximumToolOutputCharacters, description: Resources.maxCharsFieldDescription }
    }
  };

  public readonly terminalId: string;
  public readonly command: CommandLine;
  public readonly explanation: string | null;
  public readonly yieldMilliseconds: number;
  public readonly timeoutMilliseconds: number;
  public readonly maximumCharacters: number;

  public constructor(terminalId: string, command: CommandLine, explanation: string | null, yieldMilliseconds: number, timeoutMilliseconds: number, maximumCharacters: number) {
    ArgumentValidator.requireIdentifier(Resources.terminalIdField, terminalId);
    if (explanation !== null)
      ArgumentValidator.requireMaximumLength(Resources.explanationField, explanation, Resources.maximumExplanationLength);
    ArgumentValidator.requireIntegerInRange(Resources.terminalRunInputYieldMsField, yieldMilliseconds, Resources.minimumYieldMilliseconds, Resources.maximumCallMilliseconds);
    ArgumentValidator.requireIntegerInRange(Resources.terminalRunInputTimeoutMsField, timeoutMilliseconds, 0, ProtocolResources.maximumOffset);
    ArgumentValidator.requireIntegerInRange(Resources.maxCharsField, maximumCharacters, 1, Resources.maximumToolOutputCharacters);

    this.terminalId = terminalId;
    this.command = command;
    this.explanation = explanation;
    this.yieldMilliseconds = yieldMilliseconds;
    this.timeoutMilliseconds = timeoutMilliseconds;
    this.maximumCharacters = maximumCharacters;
  }

  public static fromJson(value: unknown): TerminalRunInput {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.terminalIdField, Resources.commandField, Resources.explanationField, Resources.terminalRunInputYieldMsField, Resources.terminalRunInputTimeoutMsField, Resources.maxCharsField]);
    const yieldMilliseconds: number = reader.readOptionalInteger(Resources.terminalRunInputYieldMsField, 0, ProtocolResources.maximumOffset) ?? Resources.defaultYieldMilliseconds;
    const maximumCharacters: number = reader.readOptionalInteger(Resources.maxCharsField, 1, ProtocolResources.maximumOffset) ?? Resources.maximumToolOutputCharacters;
    return new TerminalRunInput(
      reader.readNonBlankString(Resources.terminalIdField, ProtocolResources.maximumIdentifierLength),
      new CommandLine(reader.readString(Resources.commandField, Resources.maximumCommandBytes)),
      reader.readOptionalString(Resources.explanationField, Resources.maximumExplanationLength) ?? null,
      Math.min(Math.max(yieldMilliseconds, Resources.minimumYieldMilliseconds), Resources.maximumCallMilliseconds),
      reader.readOptionalInteger(Resources.terminalRunInputTimeoutMsField, 0, ProtocolResources.maximumOffset) ?? 0,
      Math.min(maximumCharacters, Resources.maximumToolOutputCharacters));
  }
}
