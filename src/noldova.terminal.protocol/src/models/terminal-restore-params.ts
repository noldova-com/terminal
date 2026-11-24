/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { ArgumentValidator } from "../services/argument.validator.ts";
import { ProtocolReader } from "../services/protocol.reader.ts";
import { TerminalSize } from "./terminal-size.ts";

export class TerminalRestoreParams {
  public readonly size: TerminalSize;
  public readonly shellId: string | null;
  public readonly storedLimit: number;

  public constructor(size: TerminalSize, shellId: string | null = null, storedLimit: number = Resources.defaultStoredLimit) {
    if (!Object.isNull(shellId))
      ArgumentValidator.requireIdentifier(Resources.shellIdField, shellId);
    ArgumentValidator.requireIntegerInRange(Resources.storedLimitField, storedLimit, Resources.minimumStoredLimit, Resources.maximumStoredLimit);

    this.size = size;
    this.shellId = shellId;
    this.storedLimit = storedLimit;
  }

  public static fromJson(value: unknown): TerminalRestoreParams {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sizeField, Resources.shellIdField, Resources.storedLimitField]);
    return reader.create(() => new TerminalRestoreParams(
      TerminalSize.fromReader(reader.readObject(Resources.sizeField)),
      reader.readNullableNonBlankString(Resources.shellIdField, Resources.maximumIdentifierLength),
      reader.readInteger(Resources.storedLimitField, Resources.minimumStoredLimit, Resources.maximumStoredLimit)));
  }

  public toJson(): JsonObject {
    return { size: this.size.toJson(), shellId: this.shellId, storedLimit: this.storedLimit };
  }
}
