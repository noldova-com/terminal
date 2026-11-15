/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonObject } from "@noldova/context.json";

import { TerminalRunEndedBy } from "../enums/terminal-run-ended-by.ts";
import { Resources } from "../resources.ts";
import { ArgumentValidator } from "../services/argument.validator.ts";
import { ProtocolReader } from "../services/protocol.reader.ts";

export class TerminalRunEnded {
  public readonly sessionId: string;
  public readonly runId: string;
  public readonly endedBy: TerminalRunEndedBy;
  public readonly exitCode: number | null;

  public constructor(sessionId: string, runId: string, endedBy: TerminalRunEndedBy, exitCode: number | null) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    ArgumentValidator.requireIdentifier(Resources.runIdField, runId);
    if (exitCode !== null) {
      ArgumentValidator.requireIntegerInRange(Resources.exitCodeField, exitCode, Resources.minimumExitCode, Resources.maximumExitCode);
      if (endedBy !== TerminalRunEndedBy.Command)
        throw new ArgumentException(Resources.formatRunEndWithCode(Resources.valueSubject), Resources.exitCodeField);
    }

    this.sessionId = sessionId;
    this.runId = runId;
    this.endedBy = endedBy;
    this.exitCode = exitCode;
  }

  public static fromJson(value: unknown): TerminalRunEnded {
    return TerminalRunEnded.fromReader(ProtocolReader.fromValue(value));
  }

  public static fromReader(reader: ProtocolReader): TerminalRunEnded {
    reader.allowOnly([Resources.sessionIdField, Resources.runIdField, Resources.endedByField, Resources.exitCodeField]);
    return reader.create(() => new TerminalRunEnded(
      reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      reader.readNonBlankString(Resources.runIdField, Resources.maximumIdentifierLength),
      reader.readOneOf(Resources.endedByField, Object.values(TerminalRunEndedBy)),
      reader.readNullableInteger(Resources.exitCodeField, Resources.minimumExitCode, Resources.maximumExitCode)));
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId, runId: this.runId, endedBy: this.endedBy, exitCode: this.exitCode };
  }
}
