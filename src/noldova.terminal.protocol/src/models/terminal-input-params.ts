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

export class TerminalInputParams {
  public readonly sessionId: string;
  public readonly data: string;

  public constructor(sessionId: string, data: string) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    ArgumentValidator.requireMaximumLength(Resources.dataField, data, Resources.maximumInputLength);

    this.sessionId = sessionId;
    this.data = data;
  }

  public static fromJson(value: unknown): TerminalInputParams {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sessionIdField, Resources.dataField]);
    return reader.create(() => new TerminalInputParams(
      reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      reader.readString(Resources.dataField, Resources.maximumInputLength)));
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId, data: this.data };
  }
}
