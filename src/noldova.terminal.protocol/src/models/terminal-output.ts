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
import { TerminalInputMark } from "./terminal-input-mark.ts";
import { TerminalLineRange } from "./terminal-line-range.ts";

export class TerminalOutput {
  public readonly sessionId: string;
  public readonly offset: number;
  public readonly data: string;
  public readonly stored: TerminalLineRange;
  public readonly inputs: readonly TerminalInputMark[];

  public constructor(sessionId: string, offset: number, data: string, stored: TerminalLineRange, inputs: readonly TerminalInputMark[] = []) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    ArgumentValidator.requireIntegerInRange(Resources.offsetField, offset, 0, Resources.maximumOffset);
    ArgumentValidator.requireMaximumLength(Resources.dataField, data, Resources.maximumOutputLength);
    let previous: number = offset;
    for (const input of inputs) {
      if (input.offset < previous || input.offset > offset + data.length)
        throw new ArgumentException(Resources.inputOutsideOutput, Resources.inputsField);
      previous = input.offset;
    }

    this.sessionId = sessionId;
    this.offset = offset;
    this.data = data;
    this.stored = stored;
    this.inputs = [...inputs];
  }

  public static fromJson(value: unknown): TerminalOutput {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sessionIdField, Resources.offsetField, Resources.dataField, Resources.storedField, Resources.inputsField]);
    return reader.create(() => new TerminalOutput(
      reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      reader.readInteger(Resources.offsetField, 0, Resources.maximumOffset),
      reader.readString(Resources.dataField, Resources.maximumOutputLength),
      TerminalLineRange.fromReader(reader.readObject(Resources.storedField)),
      reader.readObjectArray(Resources.inputsField).map(t => TerminalInputMark.fromReader(t))));
  }

  public get endOffset(): number {
    return this.offset + this.data.length;
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId, offset: this.offset, data: this.data, stored: this.stored.toJson(), inputs: this.inputs.map(t => t.toJson()) };
  }
}
