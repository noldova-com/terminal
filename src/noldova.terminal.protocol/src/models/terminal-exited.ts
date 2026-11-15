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
import { TerminalExit } from "./terminal-exit.ts";

export class TerminalExited {
  public readonly sessionId: string;
  public readonly exit: TerminalExit;

  public constructor(sessionId: string, exit: TerminalExit) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);

    this.sessionId = sessionId;
    this.exit = exit;
  }

  public static fromJson(value: unknown): TerminalExited {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sessionIdField, Resources.exitField]);
    return reader.create(() => new TerminalExited(
      reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      TerminalExit.fromReader(reader.readObject(Resources.exitField))));
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId, exit: this.exit.toJson() };
  }
}
