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

export class TerminalSize {
  public readonly columns: number;
  public readonly rows: number;

  public constructor(columns: number, rows: number) {
    ArgumentValidator.requireIntegerInRange(Resources.columnsField, columns, Resources.minimumColumns, Resources.maximumColumns);
    ArgumentValidator.requireIntegerInRange(Resources.rowsField, rows, Resources.minimumRows, Resources.maximumRows);

    this.columns = columns;
    this.rows = rows;
  }

  public static fromJson(value: unknown): TerminalSize {
    return TerminalSize.fromReader(ProtocolReader.fromValue(value));
  }

  public static fromReader(reader: ProtocolReader): TerminalSize {
    reader.allowOnly([Resources.colsField, Resources.rowsField]);
    return reader.create(() => new TerminalSize(
      reader.readInteger(Resources.colsField, Resources.minimumColumns, Resources.maximumColumns),
      reader.readInteger(Resources.rowsField, Resources.minimumRows, Resources.maximumRows)));
  }

  public equals(other: TerminalSize): boolean {
    return this.columns === other.columns && this.rows === other.rows;
  }

  public toJson(): JsonObject {
    return { cols: this.columns, rows: this.rows };
  }
}
