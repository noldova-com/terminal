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

export class TerminalFindCommandsParams {
  public readonly sessionId: string;
  public readonly names: readonly string[];

  public constructor(sessionId: string, names: readonly string[]) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    ArgumentValidator.requireCommandNames(Resources.namesField, names);

    this.sessionId = sessionId;
    this.names = [...names];
  }

  public static fromJson(value: unknown): TerminalFindCommandsParams {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sessionIdField, Resources.namesField]);
    return reader.create(() => new TerminalFindCommandsParams(
      reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      reader.readNonBlankStringArray(Resources.namesField, Resources.maximumSuggestionLength, Resources.maximumLookedUpCommands)));
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId, names: [...this.names] };
  }
}
