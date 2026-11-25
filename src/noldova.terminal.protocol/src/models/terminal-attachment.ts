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

import { TerminalShellKind } from "../enums/terminal-shell-kind.ts";
import { Resources } from "../resources.ts";
import { ArgumentValidator } from "../services/argument.validator.ts";
import { ProtocolReader } from "../services/protocol.reader.ts";
import { TerminalExit } from "./terminal-exit.ts";
import { TerminalInputStart } from "./terminal-input-start.ts";
import { TerminalLineRange } from "./terminal-line-range.ts";
import { TerminalSize } from "./terminal-size.ts";
import { WindowsPty } from "./windows-pty.ts";

export class TerminalAttachment {
  public readonly sessionId: string;
  public readonly snapshot: string;
  public readonly pending: string;
  public readonly offset: number;
  public readonly size: TerminalSize;
  public readonly title: string;
  public readonly cwd: string | null;
  public readonly exit: TerminalExit | null;
  public readonly windowsPty: WindowsPty | null;
  public readonly stored: TerminalLineRange;
  public readonly input: TerminalInputStart | null;
  public readonly commands: readonly string[];
  public readonly shellKind: TerminalShellKind;

  public constructor(
    sessionId: string,
    snapshot: string,
    pending: string,
    offset: number,
    size: TerminalSize,
    title: string,
    cwd: string | null,
    exit: TerminalExit | null,
    windowsPty: WindowsPty | null,
    stored: TerminalLineRange,
    input: TerminalInputStart | null,
    commands: readonly string[],
    shellKind: TerminalShellKind) {
    ArgumentValidator.requireIdentifier(Resources.sessionIdField, sessionId);
    ArgumentValidator.requireMaximumLength(Resources.snapshotField, snapshot, Resources.maximumSnapshotLength);
    ArgumentValidator.requireMaximumLength(Resources.pendingField, pending, Resources.maximumOutputLength);
    ArgumentValidator.requireIntegerInRange(Resources.offsetField, offset, 0, Resources.maximumOffset);
    ArgumentValidator.requireMaximumLength(Resources.titleField, title, Resources.maximumTitleLength);
    if (!Object.isNull(cwd))
      ArgumentValidator.requireNonBlank(Resources.cwdField, cwd, Resources.maximumPathLength);
    if (commands.length > Resources.maximumSuggestedCommands)
      throw new ArgumentException(Resources.commandsTooMany, Resources.commandsField);
    for (const command of commands)
      ArgumentValidator.requireNonBlank(Resources.commandsField, command, Resources.maximumSuggestionLength);

    this.sessionId = sessionId;
    this.snapshot = snapshot;
    this.pending = pending;
    this.offset = offset;
    this.size = size;
    this.title = title;
    this.cwd = cwd;
    this.exit = exit;
    this.windowsPty = windowsPty;
    this.stored = stored;
    this.input = input;
    this.commands = [...commands];
    this.shellKind = shellKind;
  }

  public static fromJson(value: unknown): TerminalAttachment {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([
      Resources.sessionIdField,
      Resources.snapshotField,
      Resources.pendingField,
      Resources.offsetField,
      Resources.sizeField,
      Resources.titleField,
      Resources.cwdField,
      Resources.exitField,
      Resources.windowsPtyField,
      Resources.storedField,
      Resources.inputField,
      Resources.commandsField,
      Resources.shellKindField
    ]);
    const exit: ProtocolReader | null = reader.readNullableObject(Resources.exitField);
    const windowsPty: ProtocolReader | null = reader.readNullableObject(Resources.windowsPtyField);
    const input: ProtocolReader | null = reader.readNullableObject(Resources.inputField);
    return reader.create(() => new TerminalAttachment(
      reader.readNonBlankString(Resources.sessionIdField, Resources.maximumIdentifierLength),
      reader.readString(Resources.snapshotField, Resources.maximumSnapshotLength),
      reader.readString(Resources.pendingField, Resources.maximumOutputLength),
      reader.readInteger(Resources.offsetField, 0, Resources.maximumOffset),
      TerminalSize.fromReader(reader.readObject(Resources.sizeField)),
      reader.readString(Resources.titleField, Resources.maximumTitleLength),
      reader.readNullableNonBlankString(Resources.cwdField, Resources.maximumPathLength),
      Object.isNull(exit) ? null : TerminalExit.fromReader(exit),
      Object.isNull(windowsPty) ? null : WindowsPty.fromReader(windowsPty),
      TerminalLineRange.fromReader(reader.readObject(Resources.storedField)),
      Object.isNull(input) ? null : TerminalInputStart.fromReader(input),
      reader.readNonBlankStringArray(Resources.commandsField, Resources.maximumSuggestionLength, Resources.maximumSuggestedCommands),
      reader.readOneOf(Resources.shellKindField, Object.values(TerminalShellKind))));
  }

  public toJson(): JsonObject {
    return {
      sessionId: this.sessionId,
      snapshot: this.snapshot,
      pending: this.pending,
      offset: this.offset,
      size: this.size.toJson(),
      title: this.title,
      cwd: this.cwd,
      exit: Object.isNull(this.exit) ? null : this.exit.toJson(),
      windowsPty: Object.isNull(this.windowsPty) ? null : this.windowsPty.toJson(),
      stored: this.stored.toJson(),
      input: Object.isNull(this.input) ? null : this.input.toJson(),
      commands: [...this.commands],
      shellKind: this.shellKind
    };
  }
}
