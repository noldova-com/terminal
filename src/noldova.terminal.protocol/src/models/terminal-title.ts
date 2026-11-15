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

export class TerminalTitle {
  public readonly sessionId: string;
  public readonly title: string;

  public constructor(sessionId: string, title: string) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    ArgumentValidator.requireMaximumLength(Resources.titleField, title, Resources.maximumTitleLength);

    this.sessionId = sessionId;
    this.title = title;
  }

  public static fromJson(value: unknown): TerminalTitle {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sessionIdField, Resources.titleField]);
    return reader.create(() => new TerminalTitle(
      reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      reader.readString(Resources.titleField, Resources.maximumTitleLength)));
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId, title: this.title };
  }
}
