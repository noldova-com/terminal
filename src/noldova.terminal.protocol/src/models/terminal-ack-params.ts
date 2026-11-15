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

export class TerminalAckParams {
  public readonly sessionId: string;
  public readonly paneId: string;
  public readonly offset: number;

  public constructor(sessionId: string, paneId: string, offset: number) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    ArgumentValidator.requireIdentifier(Resources.paneIdField, paneId);
    ArgumentValidator.requireIntegerInRange(Resources.offsetField, offset, 0, Resources.maximumOffset);

    this.sessionId = sessionId;
    this.paneId = paneId;
    this.offset = offset;
  }

  public static fromJson(value: unknown): TerminalAckParams {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sessionIdField, Resources.paneIdField, Resources.offsetField]);
    return reader.create(() => new TerminalAckParams(
      reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      reader.readNonBlankString(Resources.paneIdField, Resources.maximumIdentifierLength),
      reader.readInteger(Resources.offsetField, 0, Resources.maximumOffset)));
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId, paneId: this.paneId, offset: this.offset };
  }
}
