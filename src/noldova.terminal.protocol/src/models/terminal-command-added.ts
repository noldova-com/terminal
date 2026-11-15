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

export class TerminalCommandAdded {
  public readonly sessionId: string;
  public readonly command: string;

  public constructor(sessionId: string, command: string) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    ArgumentValidator.requireNonBlank(Resources.commandField, command, Resources.maximumSuggestionLength);

    this.sessionId = sessionId;
    this.command = command;
  }

  public static fromJson(value: unknown): TerminalCommandAdded {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sessionIdField, Resources.commandField]);
    return reader.create(() => new TerminalCommandAdded(
      reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      reader.readNonBlankString(Resources.commandField, Resources.maximumSuggestionLength)));
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId, command: this.command };
  }
}
