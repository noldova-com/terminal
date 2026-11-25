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
import { TerminalSize } from "./terminal-size.ts";

export class TerminalOpenParams {
  public readonly shellId: string | null;
  public readonly folder: string | null;
  public readonly size: TerminalSize;
  public readonly storedLimit: number;
  public readonly isPanelTerminal: boolean;
  public readonly owner: string | null;

  public constructor(shellId: string | null, folder: string | null, size: TerminalSize, storedLimit: number = Resources.defaultStoredLimit,
    isPanelTerminal: boolean = false, owner: string | null = null) {
    if (!Object.isNull(shellId))
      ArgumentValidator.requireIdentifier(Resources.shellIdField, shellId);
    if (!Object.isNull(folder))
      ArgumentValidator.requireAbsolutePath(Resources.folderField, folder);
    ArgumentValidator.requireIntegerInRange(Resources.storedLimitField, storedLimit, Resources.minimumStoredLimit, Resources.maximumStoredLimit);
    if (!Object.isNull(owner))
      ArgumentValidator.requireNonBlank(Resources.ownerField, owner, Resources.maximumOwnerLength);
    if (!Object.isNull(owner) && isPanelTerminal)
      throw new ArgumentException(Resources.panelTerminalOwned, Resources.ownerField);

    this.shellId = shellId;
    this.folder = folder;
    this.size = size;
    this.storedLimit = storedLimit;
    this.isPanelTerminal = isPanelTerminal;
    this.owner = owner;
  }

  public static fromJson(value: unknown): TerminalOpenParams {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([
      Resources.shellIdField,
      Resources.folderField,
      Resources.sizeField,
      Resources.storedLimitField,
      Resources.isPanelTerminalField,
      Resources.ownerField
    ]);
    return reader.create(() => new TerminalOpenParams(
      reader.readNullableNonBlankString(Resources.shellIdField, Resources.maximumIdentifierLength),
      reader.readNullableNonBlankString(Resources.folderField, Resources.maximumPathLength),
      TerminalSize.fromReader(reader.readObject(Resources.sizeField)),
      reader.readInteger(Resources.storedLimitField, Resources.minimumStoredLimit, Resources.maximumStoredLimit),
      reader.readOptionalBoolean(Resources.isPanelTerminalField) ?? false,
      reader.readOptionalNullableString(Resources.ownerField, Resources.maximumOwnerLength)));
  }

  public toJson(): JsonObject {
    return {
      shellId: this.shellId,
      folder: this.folder,
      size: this.size.toJson(),
      storedLimit: this.storedLimit,
      isPanelTerminal: this.isPanelTerminal,
      owner: this.owner
    };
  }
}
