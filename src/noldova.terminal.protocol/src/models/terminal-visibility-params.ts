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

export class TerminalVisibilityParams {
  public readonly sessionId: string;
  public readonly paneId: string;
  public readonly isVisible: boolean;

  public constructor(sessionId: string, paneId: string, isVisible: boolean) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    ArgumentValidator.requireIdentifier(Resources.paneIdField, paneId);

    this.sessionId = sessionId;
    this.paneId = paneId;
    this.isVisible = isVisible;
  }

  public static fromJson(value: unknown): TerminalVisibilityParams {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sessionIdField, Resources.paneIdField, Resources.visibleField]);
    return reader.create(() => new TerminalVisibilityParams(
      reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      reader.readNonBlankString(Resources.paneIdField, Resources.maximumIdentifierLength),
      reader.readBoolean(Resources.visibleField)));
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId, paneId: this.paneId, visible: this.isVisible };
  }
}
