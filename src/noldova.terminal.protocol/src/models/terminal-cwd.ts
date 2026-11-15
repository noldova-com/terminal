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

export class TerminalCwd {
  public readonly sessionId: string;
  public readonly cwd: string;

  public constructor(sessionId: string, cwd: string) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    ArgumentValidator.requireNonBlank(Resources.cwdField, cwd, Resources.maximumPathLength);

    this.sessionId = sessionId;
    this.cwd = cwd;
  }

  public static fromJson(value: unknown): TerminalCwd {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sessionIdField, Resources.cwdField]);
    return reader.create(() => new TerminalCwd(
      reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      reader.readNonBlankString(Resources.cwdField, Resources.maximumPathLength)));
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId, cwd: this.cwd };
  }
}
