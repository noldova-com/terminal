/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { JsonObject } from "@noldova/context.json";

import { TerminalShellKind } from "../enums/terminal-shell-kind.ts";
import { Resources } from "../resources.ts";
import { ArgumentValidator } from "../services/argument.validator.ts";
import { ProtocolReader } from "../services/protocol.reader.ts";
import { TerminalSize } from "./terminal-size.ts";

export class TerminalLaunchParams {
  public readonly shellId: string | null;
  public readonly folder: string | null;
  public readonly size: TerminalSize;
  public readonly storedLimit: number;
  public readonly environment: Readonly<Record<string, string>>;
  public readonly notice: string | null;
  public readonly command: string | null;
  public readonly opensTab: boolean;
  public readonly shellKinds: readonly TerminalShellKind[];

  public constructor(shellId: string | null, folder: string | null, size: TerminalSize, storedLimit: number = Resources.defaultStoredLimit,
    environment: Readonly<Record<string, string>> = {}, notice: string | null = null, command: string | null = null, opensTab: boolean = true,
    shellKinds: readonly TerminalShellKind[] = []) {
    if (!Object.isNull(shellId))
      ArgumentValidator.requireIdentifier(Resources.shellIdField, shellId);
    if (!Object.isNull(folder))
      ArgumentValidator.requireAbsolutePath(Resources.folderField, folder);
    ArgumentValidator.requireIntegerInRange(Resources.storedLimitField, storedLimit, Resources.minimumStoredLimit, Resources.maximumStoredLimit);
    ArgumentValidator.requireEnvironment(Resources.environmentField, environment);
    if (!Object.isNull(notice))
      ArgumentValidator.requireNonBlank(Resources.noticeField, notice, Resources.maximumNoticeLength);
    if (!Object.isNull(command))
      ArgumentValidator.requireCommand(Resources.commandField, command);
    ArgumentValidator.requireEachOneOf(Resources.shellKindsField, shellKinds, Object.values(TerminalShellKind));

    this.shellId = shellId;
    this.folder = folder;
    this.size = size;
    this.storedLimit = storedLimit;
    this.environment = { ...environment };
    this.notice = notice;
    this.command = command;
    this.opensTab = opensTab;
    this.shellKinds = [...shellKinds];
  }

  public static fromJson(value: unknown): TerminalLaunchParams {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([
      Resources.shellIdField,
      Resources.folderField,
      Resources.sizeField,
      Resources.storedLimitField,
      Resources.environmentField,
      Resources.noticeField,
      Resources.commandField,
      Resources.opensTabField,
      Resources.shellKindsField
    ]);
    return reader.create(() => new TerminalLaunchParams(
      reader.readNullableNonBlankString(Resources.shellIdField, Resources.maximumIdentifierLength),
      reader.readNullableNonBlankString(Resources.folderField, Resources.maximumPathLength),
      TerminalSize.fromReader(reader.readObject(Resources.sizeField)),
      reader.readInteger(Resources.storedLimitField, Resources.minimumStoredLimit, Resources.maximumStoredLimit),
      reader.readStringRecord(Resources.environmentField, Resources.maximumVariableValueLength),
      reader.readNullableNonBlankString(Resources.noticeField, Resources.maximumNoticeLength),
      reader.readNullableNonBlankString(Resources.commandField, Resources.maximumCommandLength),
      reader.readBoolean(Resources.opensTabField),
      reader.readOptionalOneOfArray(Resources.shellKindsField, Object.values(TerminalShellKind))));
  }

  public toJson(): JsonObject {
    const json: JsonObject = {
      shellId: this.shellId,
      folder: this.folder,
      size: this.size.toJson(),
      storedLimit: this.storedLimit,
      environment: { ...this.environment },
      notice: this.notice,
      command: this.command,
      opensTab: this.opensTab
    };
    return this.shellKinds.length === 0 ? json : { ...json, shellKinds: [...this.shellKinds] };
  }
}
