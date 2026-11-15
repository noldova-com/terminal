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
import type { ProtocolReader } from "../services/protocol.reader.ts";

export class TerminalInputStart {
  public readonly rowsAbove: number;
  public readonly column: number;
  public readonly rightPrompt: number | null;

  public constructor(rowsAbove: number, column: number, rightPrompt: number | null = null) {
    ArgumentValidator.requireIntegerInRange(Resources.rowsAboveField, rowsAbove, 0, Resources.maximumOffset);
    ArgumentValidator.requireIntegerInRange(Resources.columnField, column, 0, Resources.maximumColumns);
    if (rightPrompt !== null)
      ArgumentValidator.requireIntegerInRange(Resources.rightPromptField, rightPrompt, 0, Resources.maximumColumns);

    this.rowsAbove = rowsAbove;
    this.column = column;
    this.rightPrompt = rightPrompt;
  }

  public static fromReader(reader: ProtocolReader): TerminalInputStart {
    reader.allowOnly([Resources.rowsAboveField, Resources.columnField, Resources.rightPromptField]);
    return reader.create(() => new TerminalInputStart(
      reader.readInteger(Resources.rowsAboveField, 0, Resources.maximumOffset),
      reader.readInteger(Resources.columnField, 0, Resources.maximumColumns),
      reader.readNullableInteger(Resources.rightPromptField, 0, Resources.maximumColumns)));
  }

  public toJson(): JsonObject {
    return { rowsAbove: this.rowsAbove, column: this.column, rightPrompt: this.rightPrompt };
  }
}
