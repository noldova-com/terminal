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

export class TerminalLinesParams {
  public readonly sessionId: string;
  public readonly start: number;
  public readonly limit: number;

  public constructor(sessionId: string, start: number, limit: number) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    ArgumentValidator.requireIntegerInRange(Resources.startField, start, 0, Resources.maximumOffset);
    ArgumentValidator.requireIntegerInRange(Resources.limitField, limit, 1, Resources.maximumPageLines);

    this.sessionId = sessionId;
    this.start = start;
    this.limit = limit;
  }

  public static fromJson(value: unknown): TerminalLinesParams {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sessionIdField, Resources.startField, Resources.limitField]);
    return reader.create(() => new TerminalLinesParams(
      reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      reader.readInteger(Resources.startField, 0, Resources.maximumOffset),
      reader.readInteger(Resources.limitField, 1, Resources.maximumPageLines)));
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId, start: this.start, limit: this.limit };
  }
}
