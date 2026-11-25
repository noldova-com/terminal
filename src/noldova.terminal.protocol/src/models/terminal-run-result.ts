/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonObject } from "@noldova/context.json";

import { TerminalRunOutcome } from "../enums/terminal-run-outcome.ts";
import { Resources } from "../resources.ts";
import { ArgumentValidator } from "../services/argument.validator.ts";
import { ProtocolReader } from "../services/protocol.reader.ts";
import { TerminalRunEnded } from "./terminal-run-ended.ts";

export class TerminalRunResult {
  public readonly sessionId: string | null;
  public readonly outcome: TerminalRunOutcome;
  public readonly runId: string | null;
  public readonly endedRuns: readonly TerminalRunEnded[];

  public constructor(sessionId: string | null, outcome: TerminalRunOutcome, runId: string | null = null, endedRuns: readonly TerminalRunEnded[] = []) {
    if (!Object.isNull(sessionId))
      ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    if ((Object.isNull(sessionId)) !== (outcome === TerminalRunOutcome.NoShell))
      throw new ArgumentException(Resources.formatNotOneRunAnswer(Resources.valueSubject), Resources.sessionIdField);
    if (!Object.isNull(runId))
      ArgumentValidator.requireIdentifier(Resources.runIdField, runId);
    if ((Object.isNull(runId)) === (outcome === TerminalRunOutcome.Typed))
      throw new ArgumentException(Resources.formatNotOneRunId(Resources.valueSubject), Resources.runIdField);
    if (endedRuns.length > 0 && outcome !== TerminalRunOutcome.Typed)
      throw new ArgumentException(Resources.formatRunEndsUntyped(Resources.valueSubject), Resources.endedRunsField);

    this.sessionId = sessionId;
    this.outcome = outcome;
    this.runId = runId;
    this.endedRuns = [...endedRuns];
  }

  public static fromJson(value: unknown): TerminalRunResult {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sessionIdField, Resources.outcomeField, Resources.runIdField, Resources.endedRunsField]);
    return reader.create(() => new TerminalRunResult(
      reader.readNullableNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      reader.readOneOf(Resources.outcomeField, Object.values(TerminalRunOutcome)),
      reader.readNullableNonBlankString(Resources.runIdField, Resources.maximumIdentifierLength),
      reader.readObjectArray(Resources.endedRunsField).map(t => TerminalRunEnded.fromReader(t))));
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId, outcome: this.outcome, runId: this.runId, endedRuns: this.endedRuns.map(t => t.toJson()) };
  }
}
