/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { ArgumentValidator } from "../services/argument.validator.ts";
import { ProtocolReader } from "../services/protocol.reader.ts";

export class TerminalLaunched {
  public readonly sessionId: string | null;
  public readonly missingFolder: string | null;

  public constructor(sessionId: string | null, missingFolder: string | null) {
    if (!Object.isNull(sessionId))
      ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    if (!Object.isNull(missingFolder))
      ArgumentValidator.requireAbsolutePath(Resources.missingFolderField, missingFolder);
    if ((Object.isNull(sessionId)) === (Object.isNull(missingFolder)))
      throw new ArgumentException(Resources.formatNotOneLaunchAnswer(Resources.valueSubject), Resources.sessionIdField);

    this.sessionId = sessionId;
    this.missingFolder = missingFolder;
  }

  public static fromJson(value: unknown): TerminalLaunched {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.sessionIdField, Resources.missingFolderField]);
    return reader.create(() => new TerminalLaunched(
      reader.readNullableNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      reader.readNullableNonBlankString(Resources.missingFolderField, Resources.maximumPathLength)));
  }

  public toJson(): JsonObject {
    return { sessionId: this.sessionId, missingFolder: this.missingFolder };
  }
}
