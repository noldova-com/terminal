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
import type { ProtocolReader } from "../services/protocol.reader.ts";

export class TerminalLineRange {
  public readonly start: number;
  public readonly end: number;
  public readonly dropped: number;

  public constructor(start: number, end: number, dropped: number = 0) {
    ArgumentValidator.requireIntegerInRange(Resources.startField, start, 0, Resources.maximumOffset);
    ArgumentValidator.requireIntegerInRange(Resources.endField, end, 0, Resources.maximumOffset);
    ArgumentValidator.requireIntegerInRange(Resources.droppedField, dropped, 0, Resources.maximumOffset);
    if (end < start)
      throw new ArgumentException(Resources.rangeReversed, Resources.endField);
    if (dropped > start)
      throw new ArgumentException(Resources.droppedBeyondStart, Resources.droppedField);

    this.start = start;
    this.end = end;
    this.dropped = dropped;
  }

  public static fromReader(reader: ProtocolReader): TerminalLineRange {
    reader.allowOnly([Resources.startField, Resources.endField, Resources.droppedField]);
    return reader.create(() => new TerminalLineRange(
      reader.readInteger(Resources.startField, 0, Resources.maximumOffset),
      reader.readInteger(Resources.endField, 0, Resources.maximumOffset),
      reader.readInteger(Resources.droppedField, 0, Resources.maximumOffset)));
  }

  public toJson(): JsonObject {
    return { start: this.start, end: this.end, dropped: this.dropped };
  }
}
