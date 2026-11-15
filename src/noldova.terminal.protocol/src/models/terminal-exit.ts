/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import { EndedBy } from "../enums/ended-by.ts";
import { Resources } from "../resources.ts";
import { ArgumentValidator } from "../services/argument.validator.ts";
import { ProtocolReader } from "../services/protocol.reader.ts";

export class TerminalExit {
  public readonly exitCode: number | null;
  public readonly endedBy: EndedBy;

  public constructor(exitCode: number | null, endedBy: EndedBy) {
    if (exitCode !== null)
      ArgumentValidator.requireIntegerInRange(Resources.exitCodeField, exitCode, Resources.minimumExitCode, Resources.maximumExitCode);

    this.exitCode = exitCode;
    this.endedBy = endedBy;
  }

  public static fromJson(value: unknown): TerminalExit {
    return TerminalExit.fromReader(ProtocolReader.fromValue(value));
  }

  public static fromReader(reader: ProtocolReader): TerminalExit {
    reader.allowOnly([Resources.exitCodeField, Resources.endedByField]);
    return reader.create(() => new TerminalExit(
      reader.readNullableInteger(Resources.exitCodeField, Resources.minimumExitCode, Resources.maximumExitCode),
      reader.readOneOf(Resources.endedByField, Object.values(EndedBy))));
  }

  public toJson(): JsonObject {
    return { exitCode: this.exitCode, endedBy: this.endedBy };
  }
}
