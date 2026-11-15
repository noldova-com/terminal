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

export class TerminalOwnerReference {
  public readonly owner: string;

  public constructor(owner: string) {
    ArgumentValidator.requireNonBlank(Resources.ownerField, owner, Resources.maximumOwnerLength);

    this.owner = owner;
  }

  public static fromJson(value: unknown): TerminalOwnerReference {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.ownerField]);
    return reader.create(() => new TerminalOwnerReference(reader.readNonBlankString(Resources.ownerField, Resources.maximumOwnerLength)));
  }

  public toJson(): JsonObject {
    return { owner: this.owner };
  }
}
