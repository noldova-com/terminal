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

export class TerminalMissingCommands {
  public readonly names: readonly string[];

  public constructor(names: readonly string[]) {
    ArgumentValidator.requireCommandNames(Resources.namesField, names);

    this.names = [...names];
  }

  public static fromJson(value: unknown): TerminalMissingCommands {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.namesField]);
    return reader.create(() => new TerminalMissingCommands(
      reader.readNonBlankStringArray(Resources.namesField, Resources.maximumSuggestionLength, Resources.maximumLookedUpCommands)));
  }

  public toJson(): JsonObject {
    return { names: [...this.names] };
  }
}
