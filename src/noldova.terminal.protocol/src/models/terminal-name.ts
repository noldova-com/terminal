/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { ArgumentValidator } from "../services/argument.validator.ts";
import { ProtocolReader } from "../services/protocol.reader.ts";

export class TerminalName {
  public readonly sessionId: string;
  public readonly name: string | null;

  public constructor(sessionId: string, name: string | null) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    if (name !== null)
      ArgumentValidator.requireNonBlank(Resources.nameField, name, Resources.maximumTitleLength);

    this.sessionId = sessionId;
    this.name = name;
  }

  public static fromJson(value: unknown): TerminalName {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sessionIdField, Resources.nameField]);
    return reader.create(() => new TerminalName(
      reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      reader.readNullableNonBlankString(Resources.nameField, Resources.maximumTitleLength)));
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId, name: this.name };
  }
}
