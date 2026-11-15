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

export class TerminalPaneReference {
  public readonly sessionId: string;
  public readonly paneId: string;

  public constructor(sessionId: string, paneId: string) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    ArgumentValidator.requireIdentifier(Resources.paneIdField, paneId);

    this.sessionId = sessionId;
    this.paneId = paneId;
  }

  public static fromJson(value: unknown): TerminalPaneReference {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sessionIdField, Resources.paneIdField]);
    return reader.create(() => new TerminalPaneReference(
      reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      reader.readNonBlankString(Resources.paneIdField, Resources.maximumIdentifierLength)));
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId, paneId: this.paneId };
  }
}
