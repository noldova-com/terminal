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
import { TerminalSize } from "./terminal-size.ts";

export class TerminalResizeParams {
  public readonly sessionId: string;
  public readonly size: TerminalSize;

  public constructor(sessionId: string, size: TerminalSize) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);

    this.sessionId = sessionId;
    this.size = size;
  }

  public static fromJson(value: unknown): TerminalResizeParams {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sessionIdField, Resources.sizeField]);
    return reader.create(() => new TerminalResizeParams(
      reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      TerminalSize.fromReader(reader.readObject(Resources.sizeField))));
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId, size: this.size.toJson() };
  }
}
