/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonValue } from "@noldova/context.json";
import { ArgumentValidator, ProtocolReader, Resources as ProtocolResources } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";

export class TerminalNewArguments {
  public readonly folder: string | null;
  public readonly shellId: string | null;
  public readonly tabGroup: string | null;
  public readonly owner: string | null;
  public readonly takesNewOwner: boolean;

  public constructor(folder: string | null, shellId: string | null, tabGroup: string | null = null, owner: string | null = null,
    takesNewOwner: boolean = false) {
    if (!Object.isNull(folder))
      ArgumentValidator.requireAbsolutePath(Resources.folderArgument, folder);
    if (!Object.isNull(shellId))
      ArgumentValidator.requireIdentifier(Resources.shellIdArgument, shellId);
    if (!Object.isNull(tabGroup))
      ArgumentValidator.requireNonBlank(Resources.tabGroupArgument, tabGroup, ProtocolResources.maximumIdentifierLength);
    if (!Object.isNull(owner))
      ArgumentValidator.requireNonBlank(Resources.ownerArgument, owner, ProtocolResources.maximumOwnerLength);
    if (!Object.isNull(owner) && takesNewOwner)
      throw new ArgumentException(Resources.ownerTakenTwice, Resources.takesNewOwnerArgument);

    this.folder = folder;
    this.shellId = shellId;
    this.tabGroup = tabGroup;
    this.owner = owner;
    this.takesNewOwner = takesNewOwner;
  }

  public static forNewOwner(): TerminalNewArguments {
    return new TerminalNewArguments(null, null, null, null, true);
  }

  public static fromJson(value: JsonValue): TerminalNewArguments {
    if (Object.isNull(value))
      return new TerminalNewArguments(null, null);
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.folderArgument, Resources.shellIdArgument, Resources.tabGroupArgument, Resources.ownerArgument,
      Resources.takesNewOwnerArgument]);
    return new TerminalNewArguments(
      reader.readOptionalNullableString(Resources.folderArgument, ProtocolResources.maximumPathLength),
      reader.readOptionalNullableString(Resources.shellIdArgument, ProtocolResources.maximumIdentifierLength),
      reader.readOptionalNullableString(Resources.tabGroupArgument, ProtocolResources.maximumIdentifierLength),
      reader.readOptionalNullableString(Resources.ownerArgument, ProtocolResources.maximumOwnerLength),
      reader.readOptionalBoolean(Resources.takesNewOwnerArgument));
  }
}
