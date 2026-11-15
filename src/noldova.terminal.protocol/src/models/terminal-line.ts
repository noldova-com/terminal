/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { ArgumentValidator } from "../services/argument.validator.ts";
import { ProtocolReader } from "../services/protocol.reader.ts";
import { TerminalTextRun } from "./terminal-text-run.ts";

export class TerminalLine {
  public readonly text: string;
  public readonly isWrapped: boolean;
  public readonly runs: readonly TerminalTextRun[];

  public constructor(text: string, isWrapped: boolean, runs: readonly TerminalTextRun[]) {
    ArgumentValidator.requireMaximumLength(Resources.textField, text, Resources.maximumLineLength);
    if (runs.reduce((length, t) => length + t.length, 0) !== text.length)
      throw new ArgumentException(Resources.runsMismatch, Resources.runsField);

    this.text = text;
    this.isWrapped = isWrapped;
    this.runs = [...runs];
  }

  public static fromJson(value: unknown): TerminalLine {
    return TerminalLine.fromReader(ProtocolReader.fromValue(value));
  }

  public static fromReader(reader: ProtocolReader): TerminalLine {
    reader.allowOnly([Resources.textField, Resources.wrappedField, Resources.runsField]);
    return reader.create(() => new TerminalLine(
      reader.readString(Resources.textField, Resources.maximumLineLength),
      reader.readBoolean(Resources.wrappedField),
      reader.readObjectArray(Resources.runsField).map(t => TerminalTextRun.fromReader(t))));
  }

  public toJson(): JsonObject {
    return { text: this.text, wrapped: this.isWrapped, runs: this.runs.map(t => t.toJson()) };
  }
}
