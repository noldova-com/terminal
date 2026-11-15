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

export class TerminalReference {
  public readonly sessionId: string;

  public constructor(sessionId: string) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);

    this.sessionId = sessionId;
  }

  public static fromJson(value: unknown): TerminalReference {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sessionIdField]);
    return reader.create(() => new TerminalReference(reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength)));
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId };
  }
}
