/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import { TerminalRunBusy } from "../enums/terminal-run-busy.ts";
import { TerminalShellKind } from "../enums/terminal-shell-kind.ts";
import { Resources } from "../resources.ts";
import { ArgumentValidator } from "../services/argument.validator.ts";
import { ProtocolReader } from "../services/protocol.reader.ts";
import { TerminalSize } from "./terminal-size.ts";

export class TerminalRunParams {
  public readonly owner: string;
  public readonly command: string;
  public readonly folder: string | null;
  public readonly shellKinds: readonly TerminalShellKind[];
  public readonly shellId: string | null;
  public readonly size: TerminalSize;
  public readonly storedLimit: number;
  public readonly sessionId: string | null;
  public readonly whenBusy: TerminalRunBusy;
  public readonly opensTab: boolean;

  public constructor(owner: string, command: string, folder: string | null, shellKinds: readonly TerminalShellKind[], shellId: string | null,
    size: TerminalSize, storedLimit: number = Resources.defaultStoredLimit, sessionId: string | null = null,
    whenBusy: TerminalRunBusy = TerminalRunBusy.Refuse, opensTab: boolean = true) {
    ArgumentValidator.requireNonBlank(Resources.ownerField, owner, Resources.maximumOwnerLength);
    ArgumentValidator.requireScript(Resources.commandField, command);
    if (folder !== null)
      ArgumentValidator.requireAbsolutePath(Resources.folderField, folder);
    ArgumentValidator.requireEachOneOf(Resources.shellKindsField, shellKinds, Object.values(TerminalShellKind));
    if (shellId !== null)
      ArgumentValidator.requireIdentifier(Resources.shellIdField, shellId);
    ArgumentValidator.requireIntegerInRange(Resources.storedLimitField, storedLimit, Resources.minimumStoredLimit, Resources.maximumStoredLimit);
    if (sessionId !== null)
      ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    ArgumentValidator.requireOneOf(Resources.whenBusyField, whenBusy, Object.values(TerminalRunBusy));

    this.owner = owner;
    this.command = command;
    this.folder = folder;
    this.shellKinds = [...shellKinds];
    this.shellId = shellId;
    this.size = size;
    this.storedLimit = storedLimit;
    this.sessionId = sessionId;
    this.whenBusy = whenBusy;
    this.opensTab = opensTab;
  }

  public static fromJson(value: unknown): TerminalRunParams {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([
      Resources.ownerField,
      Resources.commandField,
      Resources.folderField,
      Resources.shellKindsField,
      Resources.shellIdField,
      Resources.sizeField,
      Resources.storedLimitField,
      Resources.sessionIdField,
      Resources.whenBusyField,
      Resources.opensTabField
    ]);
    return reader.create(() => new TerminalRunParams(
      reader.readNonBlankString(Resources.ownerField, Resources.maximumOwnerLength),
      reader.readNonBlankString(Resources.commandField, Resources.maximumCommandLength),
      reader.readNullableNonBlankString(Resources.folderField, Resources.maximumPathLength),
      reader.readOneOfArray(Resources.shellKindsField, Object.values(TerminalShellKind)),
      reader.readNullableNonBlankString(Resources.shellIdField, Resources.maximumIdentifierLength),
      TerminalSize.fromReader(reader.readObject(Resources.sizeField)),
      reader.readInteger(Resources.storedLimitField, Resources.minimumStoredLimit, Resources.maximumStoredLimit),
      reader.readNullableNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      reader.readOneOf(Resources.whenBusyField, Object.values(TerminalRunBusy)),
      reader.readBoolean(Resources.opensTabField)));
  }

  public toJson(): JsonObject {
    return {
      owner: this.owner,
      command: this.command,
      folder: this.folder,
      shellKinds: [...this.shellKinds],
      shellId: this.shellId,
      size: this.size.toJson(),
      storedLimit: this.storedLimit,
      sessionId: this.sessionId,
      whenBusy: this.whenBusy,
      opensTab: this.opensTab
    };
  }
}
