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

export class TerminalCompleteParams {
  public readonly sessionId: string;
  public readonly line: string;
  public readonly cursor: number;
  public readonly asksShell: boolean;

  public constructor(sessionId: string, line: string, cursor: number, asksShell: boolean = false) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    ArgumentValidator.requireMaximumLength(Resources.lineField, line, Resources.maximumSuggestionLength);
    ArgumentValidator.requireIntegerInRange(Resources.cursorField, cursor, 0, line.length);

    this.sessionId = sessionId;
    this.line = line;
    this.cursor = cursor;
    this.asksShell = asksShell;
  }

  public static fromJson(value: unknown): TerminalCompleteParams {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([
      Resources.sessionIdField,
      Resources.lineField,
      Resources.cursorField,
      Resources.asksShellField
    ]);
    const line: string = reader.readString(Resources.lineField, Resources.maximumSuggestionLength);
    return reader.create(() => new TerminalCompleteParams(
      reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      line,
      reader.readInteger(Resources.cursorField, 0, line.length),
      reader.readOptionalBoolean(Resources.asksShellField) ?? false));
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId, line: this.line, cursor: this.cursor, asksShell: this.asksShell };
  }
}
