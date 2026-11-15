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

export class TerminalRunOutputParams {
  public readonly sessionId: string;
  public readonly runId: string;
  public readonly maximumLines: number;

  public constructor(sessionId: string, runId: string, maximumLines: number) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    ArgumentValidator.requireIdentifier(Resources.runIdField, runId);
    ArgumentValidator.requireIntegerInRange(Resources.maximumLinesField, maximumLines, 1, Resources.maximumRunLines);

    this.sessionId = sessionId;
    this.runId = runId;
    this.maximumLines = maximumLines;
  }

  public static fromJson(value: unknown): TerminalRunOutputParams {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sessionIdField, Resources.runIdField, Resources.maximumLinesField]);
    return reader.create(() => new TerminalRunOutputParams(
      reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      reader.readNonBlankString(Resources.runIdField, Resources.maximumIdentifierLength),
      reader.readInteger(Resources.maximumLinesField, 1, Resources.maximumRunLines)));
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId, runId: this.runId, maximumLines: this.maximumLines };
  }
}
