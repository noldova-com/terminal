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
import { KeySequence } from "./key-sequence.ts";

export class TerminalWriteInput {
  public static readonly schema: JsonObject = {
    type: Resources.jsonObjectType,
    additionalProperties: false,
    required: [Resources.terminalIdField, Resources.keysField],
    properties: {
      [Resources.terminalIdField]: { type: Resources.jsonStringType, minLength: 1, description: Resources.terminalIdFieldDescription },
      [Resources.keysField]: { type: Resources.jsonStringType, minLength: 1, description: Resources.keysFieldDescription },
      [Resources.explanationField]: { type: Resources.jsonStringType, maxLength: Resources.maximumExplanationLength, description: Resources.explanationFieldDescription }
    }
  };

  public readonly terminalId: string;
  public readonly keys: KeySequence;
  public readonly explanation: string | null;

  public constructor(terminalId: string, keys: KeySequence, explanation: string | null) {
    ArgumentValidator.requireIdentifier(Resources.terminalIdField, terminalId);
    if (!Object.isNull(explanation))
      ArgumentValidator.requireMaximumLength(Resources.explanationField, explanation, Resources.maximumExplanationLength);

    this.terminalId = terminalId;
    this.keys = keys;
    this.explanation = explanation;
  }

  public static fromJson(value: unknown): TerminalWriteInput {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.terminalIdField, Resources.keysField, Resources.explanationField]);
    return new TerminalWriteInput(
      reader.readNonBlankString(Resources.terminalIdField, ProtocolResources.maximumIdentifierLength),
      new KeySequence(reader.readString(Resources.keysField, Resources.maximumKeysBytes)),
      reader.readOptionalString(Resources.explanationField, Resources.maximumExplanationLength) ?? null);
  }
}
