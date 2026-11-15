/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { ArgumentValidator } from "../services/argument.validator.ts";
import { ProtocolReader } from "../services/protocol.reader.ts";
import { TerminalLine } from "./terminal-line.ts";
import { TerminalLineRange } from "./terminal-line-range.ts";

export class TerminalLinePage {
  public readonly start: number;
  public readonly lines: readonly TerminalLine[];
  public readonly stored: TerminalLineRange;

  public constructor(start: number, lines: readonly TerminalLine[], stored: TerminalLineRange) {
    ArgumentValidator.requireIntegerInRange(Resources.startField, start, 0, Resources.maximumOffset);
    if (lines.length > Resources.maximumPageLines)
      throw new ArgumentException(Resources.formatTooManyLines(Resources.valueSubject, Resources.maximumPageLines), Resources.linesField);
    if (start < stored.start || start + lines.length > stored.end)
      throw new ArgumentException(Resources.pageOutsideStored, Resources.linesField);

    this.start = start;
    this.lines = [...lines];
    this.stored = stored;
  }

  public static fromJson(value: unknown): TerminalLinePage {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.startField, Resources.linesField, Resources.storedField]);
    const start: number = reader.readInteger(Resources.startField, 0, Resources.maximumOffset);
    const lines: readonly ProtocolReader[] = reader.readObjectArray(Resources.linesField);
    if (lines.length > Resources.maximumPageLines)
      throw new JsonException(Resources.formatMoreItemsThan(Resources.maximumPageLines), Resources.formatFieldPath(reader.path, Resources.linesField));
    return reader.create(() => new TerminalLinePage(
      start,
      lines.map(t => TerminalLine.fromReader(t)),
      TerminalLineRange.fromReader(reader.readObject(Resources.storedField))));
  }

  public toJson(): JsonObject {
    return { start: this.start, lines: this.lines.map(t => t.toJson()), stored: this.stored.toJson() };
  }
}
