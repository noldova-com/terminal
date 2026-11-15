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

export class TerminalRunOutput {
  public readonly lines: readonly TerminalLine[];
  public readonly cutLines: number;

  public constructor(lines: readonly TerminalLine[], cutLines: number) {
    if (lines.length > Resources.maximumRunLines)
      throw new ArgumentException(Resources.formatTooManyLines(Resources.valueSubject, Resources.maximumRunLines), Resources.linesField);
    ArgumentValidator.requireIntegerInRange(Resources.cutLinesField, cutLines, 0, Resources.maximumOffset);

    this.lines = [...lines];
    this.cutLines = cutLines;
  }

  public static fromJson(value: unknown): TerminalRunOutput {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.linesField, Resources.cutLinesField]);
    const lines: readonly ProtocolReader[] = reader.readObjectArray(Resources.linesField);
    if (lines.length > Resources.maximumRunLines)
      throw new JsonException(Resources.formatMoreItemsThan(Resources.maximumRunLines), Resources.formatFieldPath(reader.path, Resources.linesField));
    return reader.create(() => new TerminalRunOutput(
      lines.map(t => TerminalLine.fromReader(t)),
      reader.readInteger(Resources.cutLinesField, 0, Resources.maximumOffset)));
  }

  public toJson(): JsonObject {
    return { lines: this.lines.map(t => t.toJson()), cutLines: this.cutLines };
  }
}
