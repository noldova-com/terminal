/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import { TerminalShellKind } from "../enums/terminal-shell-kind.ts";
import { Resources } from "../resources.ts";
import { ArgumentValidator } from "../services/argument.validator.ts";
import { ProtocolReader } from "../services/protocol.reader.ts";

export class TerminalShell {
  public readonly id: string;
  public readonly name: string;
  public readonly kind: TerminalShellKind;
  public readonly isDefault: boolean;

  public constructor(id: string, name: string, kind: TerminalShellKind, isDefault: boolean) {
    ArgumentValidator.requireIdentifier(Resources.idField, id);
    ArgumentValidator.requireNonBlank(Resources.nameField, name, Resources.maximumNameLength);

    this.id = id;
    this.name = name;
    this.kind = kind;
    this.isDefault = isDefault;
  }

  public static fromJson(value: unknown): TerminalShell {
    return TerminalShell.fromReader(ProtocolReader.fromValue(value));
  }

  public static fromReader(reader: ProtocolReader): TerminalShell {
    reader.allowOnly([Resources.idField, Resources.nameField, Resources.kindField, Resources.isDefaultField]);
    return reader.create(() => new TerminalShell(
      reader.readNonBlankString(Resources.idField, Resources.maximumIdentifierLength),
      reader.readNonBlankString(Resources.nameField, Resources.maximumNameLength),
      reader.readOneOf(Resources.kindField, Object.values(TerminalShellKind)),
      reader.readBoolean(Resources.isDefaultField)));
  }

  public toJson(): JsonObject {
    return { id: this.id, name: this.name, kind: this.kind, isDefault: this.isDefault };
  }
}
