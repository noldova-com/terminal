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

export class TerminalOpenInput {
  public static readonly schema: JsonObject = {
    type: Resources.jsonObjectType,
    additionalProperties: false,
    properties: {
      [Resources.shellField]: { type: Resources.jsonStringType, minLength: 1, description: Resources.shellFieldDescription },
      [Resources.explanationField]: { type: Resources.jsonStringType, maxLength: Resources.maximumExplanationLength, description: Resources.explanationFieldDescription }
    }
  };

  public readonly shellId: string | null;
  public readonly explanation: string | null;

  public constructor(shellId: string | null, explanation: string | null) {
    if (shellId !== null)
      ArgumentValidator.requireIdentifier(Resources.shellField, shellId);
    if (explanation !== null)
      ArgumentValidator.requireMaximumLength(Resources.explanationField, explanation, Resources.maximumExplanationLength);

    this.shellId = shellId;
    this.explanation = explanation;
  }

  public static fromJson(value: unknown): TerminalOpenInput {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.shellField, Resources.explanationField]);
    return new TerminalOpenInput(
      reader.readOptionalString(Resources.shellField, ProtocolResources.maximumIdentifierLength) ?? null,
      reader.readOptionalString(Resources.explanationField, Resources.maximumExplanationLength) ?? null);
  }
}
