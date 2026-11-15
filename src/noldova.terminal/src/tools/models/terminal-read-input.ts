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

export class TerminalReadInput {
  public static readonly schema: JsonObject = {
    type: Resources.jsonObjectType,
    additionalProperties: false,
    required: [Resources.terminalIdField],
    properties: {
      [Resources.terminalIdField]: { type: Resources.jsonStringType, minLength: 1, description: Resources.terminalIdFieldDescription },
      [Resources.terminalReadInputWaitMsField]: { type: Resources.jsonIntegerType, minimum: 0, default: 0, description: Resources.waitFieldDescription },
      [Resources.maxCharsField]: { type: Resources.jsonIntegerType, minimum: 1, default: Resources.maximumToolOutputCharacters, description: Resources.maxCharsFieldDescription }
    }
  };

  public readonly terminalId: string;
  public readonly waitMilliseconds: number;
  public readonly maximumCharacters: number;

  public constructor(terminalId: string, waitMilliseconds: number, maximumCharacters: number) {
    ArgumentValidator.requireIdentifier(Resources.terminalIdField, terminalId);
    ArgumentValidator.requireIntegerInRange(Resources.terminalReadInputWaitMsField, waitMilliseconds, 0, Resources.maximumCallMilliseconds);
    ArgumentValidator.requireIntegerInRange(Resources.maxCharsField, maximumCharacters, 1, Resources.maximumToolOutputCharacters);

    this.terminalId = terminalId;
    this.waitMilliseconds = waitMilliseconds;
    this.maximumCharacters = maximumCharacters;
  }

  public static fromJson(value: unknown): TerminalReadInput {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.terminalIdField, Resources.terminalReadInputWaitMsField, Resources.maxCharsField]);
    const waitMilliseconds: number = reader.readOptionalInteger(Resources.terminalReadInputWaitMsField, 0, ProtocolResources.maximumOffset) ?? 0;
    const maximumCharacters: number = reader.readOptionalInteger(Resources.maxCharsField, 1, ProtocolResources.maximumOffset) ?? Resources.maximumToolOutputCharacters;
    return new TerminalReadInput(
      reader.readNonBlankString(Resources.terminalIdField, ProtocolResources.maximumIdentifierLength),
      Math.min(waitMilliseconds, Resources.maximumCallMilliseconds),
      Math.min(maximumCharacters, Resources.maximumToolOutputCharacters));
  }
}
