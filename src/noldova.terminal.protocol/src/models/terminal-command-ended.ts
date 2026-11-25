/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { ArgumentValidator } from "../services/argument.validator.ts";
import { ProtocolReader } from "../services/protocol.reader.ts";

export class TerminalCommandEnded {
  public readonly sessionId: string;
  public readonly exitCode: number | null;

  public constructor(sessionId: string, exitCode: number | null) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    if (!Object.isNull(exitCode))
      ArgumentValidator.requireIntegerInRange(Resources.exitCodeField, exitCode, Resources.minimumExitCode, Resources.maximumExitCode);

    this.sessionId = sessionId;
    this.exitCode = exitCode;
  }

  public static fromJson(value: unknown): TerminalCommandEnded {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sessionIdField, Resources.exitCodeField]);
    return reader.create(() => new TerminalCommandEnded(
      reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      reader.readNullableInteger(Resources.exitCodeField, Resources.minimumExitCode, Resources.maximumExitCode)));
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId, exitCode: this.exitCode };
  }
}
