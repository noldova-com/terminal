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
import { TerminalExit } from "./terminal-exit.ts";

export class TerminalSummary {
  public readonly sessionId: string;
  public readonly shellId: string;
  public readonly folder: string;
  public readonly title: string;
  public readonly exit: TerminalExit | null;
  public readonly isAgentTerminal: boolean;
  public readonly isPanelTerminal: boolean;
  public readonly owner: string | null;
  public readonly opensTab: boolean;
  public readonly name: string | null;
  public readonly shellName: string | null;
  public readonly shellKind: TerminalShellKind;

  public constructor(sessionId: string, shellId: string, folder: string, title: string, exit: TerminalExit | null, isAgentTerminal: boolean,
    isPanelTerminal: boolean, owner: string | null, opensTab: boolean, name: string | null, shellName: string | null, shellKind: TerminalShellKind) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    ArgumentValidator.requireIdentifier(Resources.shellIdField, shellId);
    ArgumentValidator.requireNonBlank(Resources.folderField, folder, Resources.maximumPathLength);
    ArgumentValidator.requireMaximumLength(Resources.titleField, title, Resources.maximumTitleLength);
    if (!Object.isNull(owner))
      ArgumentValidator.requireNonBlank(Resources.ownerField, owner, Resources.maximumOwnerLength);
    if (!Object.isNull(name))
      ArgumentValidator.requireNonBlank(Resources.nameField, name, Resources.maximumTitleLength);
    if (!Object.isNull(shellName))
      ArgumentValidator.requireNonBlank(Resources.shellNameField, shellName, Resources.maximumTitleLength);

    this.sessionId = sessionId;
    this.shellId = shellId;
    this.folder = folder;
    this.title = title;
    this.exit = exit;
    this.isAgentTerminal = isAgentTerminal;
    this.isPanelTerminal = isPanelTerminal;
    this.owner = owner;
    this.opensTab = opensTab;
    this.name = name;
    this.shellName = shellName;
    this.shellKind = shellKind;
  }

  public static fromJson(value: unknown): TerminalSummary {
    return TerminalSummary.fromReader(ProtocolReader.fromValue(value));
  }

  public static fromReader(reader: ProtocolReader): TerminalSummary {
    reader.allowOnly([
      Resources.sessionIdField,
      Resources.shellIdField,
      Resources.folderField,
      Resources.titleField,
      Resources.exitField,
      Resources.isAgentTerminalField,
      Resources.isPanelTerminalField,
      Resources.ownerField,
      Resources.opensTabField,
      Resources.nameField,
      Resources.shellNameField,
      Resources.shellKindField
    ]);
    const exit: ProtocolReader | null = reader.readNullableObject(Resources.exitField);
    return reader.create(() => new TerminalSummary(
      reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      reader.readNonBlankString(Resources.shellIdField, Resources.maximumIdentifierLength),
      reader.readNonBlankString(Resources.folderField, Resources.maximumPathLength),
      reader.readString(Resources.titleField, Resources.maximumTitleLength),
      Object.isNull(exit) ? null : TerminalExit.fromReader(exit),
      reader.readBoolean(Resources.isAgentTerminalField),
      reader.readBoolean(Resources.isPanelTerminalField),
      reader.readNullableNonBlankString(Resources.ownerField, Resources.maximumOwnerLength),
      reader.readBoolean(Resources.opensTabField),
      reader.readNullableNonBlankString(Resources.nameField, Resources.maximumTitleLength),
      reader.readNullableNonBlankString(Resources.shellNameField, Resources.maximumTitleLength),
      reader.readOneOf(Resources.shellKindField, Object.values(TerminalShellKind))));
  }

  public toJson(): JsonObject {
    return {
      sessionId: this.sessionId,
      shellId: this.shellId,
      folder: this.folder,
      title: this.title,
      exit: Object.isNull(this.exit) ? null : this.exit.toJson(),
      isAgentTerminal: this.isAgentTerminal,
      isPanelTerminal: this.isPanelTerminal,
      owner: this.owner,
      opensTab: this.opensTab,
      name: this.name,
      shellName: this.shellName,
      shellKind: this.shellKind
    };
  }
}
