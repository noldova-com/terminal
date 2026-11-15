/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { ProtocolReader } from "../services/protocol.reader.ts";
import { TerminalSummary } from "./terminal-summary.ts";

export class TerminalSessions {
  public readonly sessions: readonly TerminalSummary[];

  public constructor(sessions: readonly TerminalSummary[]) {
    this.sessions = [...sessions];
  }

  public static fromJson(value: unknown): TerminalSessions {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sessionsField]);
    return reader.create(() => new TerminalSessions(
      reader.readObjectArray(Resources.sessionsField).map(t => TerminalSummary.fromReader(t))));
  }

  public toJson(): JsonObject {
    return { sessions: this.sessions.map(t => t.toJson()) };
  }
}
