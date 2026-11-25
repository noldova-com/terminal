/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { JsonObject } from "@noldova/context.json";
import { ArgumentValidator, ProtocolReader, Resources as ProtocolResources } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";

export class TerminalTargetInput {
  public static readonly schema: JsonObject = {
    type: Resources.jsonObjectType,
    additionalProperties: false,
    required: [Resources.terminalIdField],
    properties: {
      [Resources.terminalIdField]: { type: Resources.jsonStringType, minLength: 1, description: Resources.terminalIdFieldDescription },
      [Resources.explanationField]: { type: Resources.jsonStringType, maxLength: Resources.maximumExplanationLength, description: Resources.explanationFieldDescription }
    }
  };

  public readonly terminalId: string;
  public readonly explanation: string | null;

  public constructor(terminalId: string, explanation: string | null) {
    ArgumentValidator.requireIdentifier(Resources.terminalIdField, terminalId);
    if (!Object.isNull(explanation))
      ArgumentValidator.requireMaximumLength(Resources.explanationField, explanation, Resources.maximumExplanationLength);

    this.terminalId = terminalId;
    this.explanation = explanation;
  }

  public static fromJson(value: unknown): TerminalTargetInput {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.terminalIdField, Resources.explanationField]);
    return new TerminalTargetInput(
      reader.readNonBlankString(Resources.terminalIdField, ProtocolResources.maximumIdentifierLength),
      reader.readOptionalString(Resources.explanationField, Resources.maximumExplanationLength) ?? null);
  }
}
