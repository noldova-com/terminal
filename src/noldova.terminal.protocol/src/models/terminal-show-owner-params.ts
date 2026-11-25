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

export class TerminalShowOwnerParams {
  public readonly owner: string | null;
  public readonly isHidden: boolean;

  public constructor(owner: string | null, isHidden: boolean = false) {
    if (!Object.isNull(owner))
      ArgumentValidator.requireNonBlank(Resources.ownerField, owner, Resources.maximumOwnerLength);

    this.owner = owner;
    this.isHidden = isHidden;
  }

  public static fromJson(value: unknown): TerminalShowOwnerParams {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.ownerField, Resources.isHiddenField]);
    return reader.create(() => new TerminalShowOwnerParams(
      reader.readNullableNonBlankString(Resources.ownerField, Resources.maximumOwnerLength),
      reader.readOptionalBoolean(Resources.isHiddenField) ?? false));
  }

  public toJson(): JsonObject {
    return { owner: this.owner, isHidden: this.isHidden };
  }
}
