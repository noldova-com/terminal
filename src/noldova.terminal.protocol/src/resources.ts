/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly rootPath: string = "$";
  public static readonly valueSubject: string = "The value";
  public static readonly minimumColumns: number = 1;
  public static readonly maximumColumns: number = 1_000;
  public static readonly minimumRows: number = 1;
  public static readonly maximumRows: number = 1_000;
  public static readonly maximumIdentifierLength: number = 200;
  public static readonly maximumInputLength: number = 1_048_576;
  public static readonly maximumOutputLength: number = 1_048_576;
  public static readonly maximumSnapshotLength: number = 16_777_216;
  public static readonly maximumPathLength: number = 4_096;
  public static readonly absolutePathPattern: RegExp = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/u;
  public static readonly maximumTitleLength: number = 4_096;
  public static readonly maximumNameLength: number = 200;
  public static readonly maximumOwnerLength: number = 256;
  public static readonly runtimeOwnersBrand: string = "@noldova/terminal.protocol/RuntimeTerminalOwners";
  public static readonly runtimeOwnersCopies: string = "The terminal.owners service comes from another installed copy of @noldova/terminal.protocol: "
    + "install one copy, at Terminal's version, so that RuntimeTerminalOwners matches it.";
  public static readonly maximumVariables: number = 256;
  public static readonly maximumVariableNameLength: number = 256;
  public static readonly maximumVariableValueLength: number = 32_767;
  public static readonly maximumEnvironmentLength: number = 131_072;
  public static readonly variableNamePattern: RegExp = /^[A-Za-z_][A-Za-z0-9_]*$/u;
  public static readonly refusedVariables: readonly string[] = ["TERM", "COLORTERM", "ZDOTDIR"];
  public static readonly refusedVariablePrefix: string = "NOLDOVA_TERMINAL_";
  public static readonly maximumNoticeLength: number = 4_096;
  public static readonly maximumCommandLength: number = 16_384;
  public static readonly controlCharacters: RegExp = /[\u0000-\u001f\u007f-\u009f]/u;
  public static readonly scriptControlCharacters: RegExp = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]|\r(?!\n)/u;
  public static readonly scriptHiddenCharacters: RegExp = new RegExp("[\\p{Cf}\\p{Default_Ignorable_Code_Point}]", "v");
  public static readonly scriptEmoji: RegExp = new RegExp("\\p{RGI_Emoji}", "gv");
  public static readonly minimumExitCode: number = -2_147_483_648;
  public static readonly maximumExitCode: number = 4_294_967_295;
  public static readonly maximumBuildNumber: number = 4_294_967_295;
  public static readonly maximumOffset: number = Number.MAX_SAFE_INTEGER;
  public static readonly conptyBackend: string = "conpty";
  public static readonly suggestionsSetting: string = "terminal.suggestions";
  public static readonly defaultColor: number = -1;
  public static readonly paletteSize: number = 256;
  public static readonly rgbColor: number = 0x1000000;
  public static readonly maximumColor: number = 0x1ffffff;
  public static readonly maximumTextStyle: number = 0x1ff;
  public static readonly maximumLineLength: number = 1_048_576;
  public static readonly maximumPageLines: number = 500;
  public static readonly maximumRunLines: number = 5_000;
  public static readonly storedLimitUnit: number = 1_048_576;
  public static readonly defaultStoredLimit: number = 100 * Resources.storedLimitUnit;
  public static readonly minimumStoredLimit: number = 10 * Resources.storedLimitUnit;
  public static readonly maximumStoredLimit: number = 10_000 * Resources.storedLimitUnit;
  public static readonly runsMismatch: string = "The value must cover the line's text exactly.";
  public static readonly rangeReversed: string = "The value must not come before start.";
  public static readonly droppedBeyondStart: string = "The value must not be more than start.";
  public static readonly maximumSuggestionLength: number = 4_096;
  public static readonly maximumSuggestedCommands: number = 200;
  public static readonly commandsTooMany: string = `The value must hold at most ${Resources.maximumSuggestedCommands} commands.`;
  public static readonly maximumLookedUpCommands: number = 64;
  public static readonly maximumCompletionItems: number = 500;
  public static readonly completionItemsTooMany: string = `The value must hold at most ${Resources.maximumCompletionItems} choices.`;
  public static readonly inputOutsideOutput: string = "The value must lie within the output, in order.";
  public static readonly pageOutsideStored: string = "A page's lines must lie within the stored lines.";
  public static readonly panelTerminalOwned: string = "A panel terminal has no owner.";
  public static readonly commandField: string = "command";
  public static readonly cwdField: string = "cwd";
  public static readonly dataField: string = "data";
  public static readonly endedByField: string = "endedBy";
  public static readonly exitField: string = "exit";
  public static readonly exitCodeField: string = "exitCode";
  public static readonly folderField: string = "folder";
  public static readonly isPanelTerminalField: string = "isPanelTerminal";
  public static readonly kindField: string = "kind";
  public static readonly linesField: string = "lines";
  public static readonly nameField: string = "name";
  public static readonly namesField: string = "names";
  public static readonly offsetField: string = "offset";
  public static readonly opensTabField: string = "opensTab";
  public static readonly ownerField: string = "owner";
  public static readonly paneIdField: string = "paneId";
  public static readonly runIdField: string = "runId";
  public static readonly sessionIdField: string = "sessionId";
  public static readonly shellIdField: string = "shellId";
  public static readonly shellKindsField: string = "shellKinds";
  public static readonly sizeField: string = "size";
  public static readonly startField: string = "start";
  public static readonly storedField: string = "stored";
  public static readonly storedLimitField: string = "storedLimit";
  public static readonly textField: string = "text";
  public static readonly titleField: string = "title";
  public static readonly unknownField: string = "The field is not known.";
  public static readonly blankItem: string = "The item must not be blank.";
  public static readonly snapshotField: string = "snapshot";
  public static readonly pendingField: string = "pending";
  public static readonly commandsField: string = "commands";
  public static readonly windowsPtyField: string = "windowsPty";
  public static readonly inputField: string = "input";
  public static readonly shellKindField: string = "shellKind";
  public static readonly lineField: string = "line";
  public static readonly cursorField: string = "cursor";
  public static readonly asksShellField: string = "asksShell";
  public static readonly labelField: string = "label";
  public static readonly replaceFromField: string = "replaceFrom";
  public static readonly itemsField: string = "items";
  public static readonly isShellTabField: string = "isShellTab";
  public static readonly edgeField: string = "edge";
  public static readonly rowsAboveField: string = "rowsAbove";
  public static readonly columnField: string = "column";
  public static readonly rightPromptField: string = "rightPrompt";
  public static readonly environmentField: string = "environment";
  public static readonly noticeField: string = "notice";
  public static readonly missingFolderField: string = "missingFolder";
  public static readonly endField: string = "end";
  public static readonly droppedField: string = "dropped";
  public static readonly runsField: string = "runs";
  public static readonly wrappedField: string = "wrapped";
  public static readonly limitField: string = "limit";
  public static readonly shellsMethod: string = "terminal.shells";
  public static readonly openMethod: string = "terminal.open";
  public static readonly closeMethod: string = "terminal.close";
  public static readonly restartMethod: string = "terminal.restart";
  public static readonly sessionsMethod: string = "terminal.sessions";
  public static readonly attachMethod: string = "terminal.attach";
  public static readonly inputMethod: string = "terminal.input";
  public static readonly resizeMethod: string = "terminal.resize";
  public static readonly ackMethod: string = "terminal.ack";
  public static readonly visibilityMethod: string = "terminal.visibility";
  public static readonly detachMethod: string = "terminal.detach";
  public static readonly linesMethod: string = "terminal.lines";
  public static readonly restoreMethod: string = "terminal.restore";
  public static readonly closeOwnerMethod: string = "terminal.closeOwner";
  public static readonly launchMethod: string = "terminal.launch";
  public static readonly runMethod: string = "terminal.run";
  public static readonly runOutputMethod: string = "terminal.runOutput";
  public static readonly windowStartedMethod: string = "terminal.windowStarted";
  public static readonly showOwnerMethod: string = "terminal.showOwner";
  public static readonly renameMethod: string = "terminal.rename";
  public static readonly completeMethod: string = "terminal.complete";
  public static readonly findCommandsMethod: string = "terminal.findCommands";
  public static readonly outputEvent: string = "terminal.output";
  public static readonly exitedEvent: string = "terminal.exited";
  public static readonly restartedEvent: string = "terminal.restarted";
  public static readonly titleChangedEvent: string = "terminal.titleChanged";
  public static readonly cwdChangedEvent: string = "terminal.cwdChanged";
  public static readonly detachedEvent: string = "terminal.detached";
  public static readonly closedEvent: string = "terminal.closed";
  public static readonly openedEvent: string = "terminal.opened";
  public static readonly runOpenedEvent: string = "terminal.runOpened";
  public static readonly launchCommandEndedEvent: string = "terminal.launchCommandEnded";
  public static readonly runEndedEvent: string = "terminal.runEnded";
  public static readonly renamedEvent: string = "terminal.renamed";
  public static readonly commandAddedEvent: string = "terminal.commandAdded";
  public static readonly inputsField: string = "inputs";
  public static readonly maximumLinesField: string = "maximumLines";
  public static readonly cutLinesField: string = "cutLines";
  public static readonly whenBusyField: string = "whenBusy";
  public static readonly endedRunsField: string = "endedRuns";
  public static readonly outcomeField: string = "outcome";
  public static readonly sessionsField: string = "sessions";
  public static readonly idField: string = "id";
  public static readonly isDefaultField: string = "isDefault";
  public static readonly shellsField: string = "shells";
  public static readonly isHiddenField: string = "isHidden";
  public static readonly columnsField: string = "columns";
  public static readonly rowsField: string = "rows";
  public static readonly colsField: string = "cols";
  public static readonly isAgentTerminalField: string = "isAgentTerminal";
  public static readonly shellNameField: string = "shellName";
  public static readonly lengthField: string = "length";
  public static readonly foregroundField: string = "foreground";
  public static readonly backgroundField: string = "background";
  public static readonly styleField: string = "style";
  public static readonly visibleField: string = "visible";
  public static readonly buildNumberField: string = "buildNumber";
  public static readonly backendField: string = "backend";
  public static readonly nullCharacter: string = "\u0000";

  public static formatFieldPath(path: string, name: string): string {
    return `${path}.${name}`;
  }

  public static formatIndexPath(path: string, index: number): string {
    return `${path}[${index}]`;
  }

  public static formatLongerThan(maximum: number): string {
    return `Expected at most ${maximum} characters.`;
  }

  public static formatOutsideRange(minimum: number, maximum: number): string {
    return `Expected a whole number from ${minimum} to ${maximum}.`;
  }

  public static formatMoreItemsThan(maximum: number): string {
    return `Expected at most ${maximum} items.`;
  }

  public static formatExpectedOneOf(values: readonly string[]): string {
    return `Expected one of ${values.join(", ")}.`;
  }

  public static formatNotString(path: string): string {
    return `${path} must be a string.`;
  }

  public static formatBlankString(path: string): string {
    return `${path} must not be blank.`;
  }

  public static formatTooLong(path: string, maximum: number): string {
    return `${path} must have at most ${maximum} characters.`;
  }

  public static formatNotAbsolutePath(path: string): string {
    return `${path} must be an absolute path.`;
  }

  public static formatNotIntegerInRange(path: string, minimum: number, maximum: number): string {
    return `${path} must be a whole number from ${minimum} to ${maximum}.`;
  }

  public static formatNotOneOf(path: string, values: readonly string[]): string {
    return `${path} must be one of ${values.join(", ")}.`;
  }

  public static formatTooManyVariables(path: string, maximum: number): string {
    return `${path} must have at most ${maximum} variables.`;
  }

  public static formatNotVariableName(path: string): string {
    return `${path} holds a name that isn't a portable variable name: a letter or _, then letters, digits or _.`;
  }

  public static formatRefusedVariable(path: string): string {
    return `${path} is set by the terminal itself, so it can't be given.`;
  }

  public static formatSameVariable(path: string, other: string): string {
    return `${path} and ${other} differ only in case, which Windows reads as one variable.`;
  }

  public static formatEnvironmentTooLong(path: string, maximum: number): string {
    return `${path} must have at most ${maximum} characters of names and values in all.`;
  }

  public static formatControlCharacter(path: string): string {
    return `${path} must not hold a control character, such as a line break, since the terminal types it as one line and enters it.`;
  }

  public static formatScriptControlCharacter(path: string): string {
    return `${path} must not hold a control character other than a line break or a tab.`;
  }

  public static formatScriptHiddenCharacter(path: string, character: string): string {
    const codePoint: string = Number(character.codePointAt(0)).toString(16).toUpperCase().padStart(4, "0");
    return `${path} holds U+${codePoint}, a format or default-ignorable character, which would make it read differently from what runs.`;
  }

  public static formatNullCharacter(path: string): string {
    return `${path} must not hold a null character.`;
  }

  public static formatNotOneLaunchAnswer(path: string): string {
    return `${path} must give either sessionId or missingFolder, not both or neither.`;
  }

  public static formatNotOneRunAnswer(path: string): string {
    return `${path} must give a sessionId unless its outcome is NoShell, and none when it is.`;
  }

  public static formatTooManyNames(path: string, maximum: number): string {
    return `${path} must hold at most ${maximum} names.`;
  }

  public static formatTooManyLines(path: string, maximum: number): string {
    return `${path} must hold at most ${maximum} lines.`;
  }

  public static formatNotOneRunId(path: string): string {
    return `${path} must give a runId when its outcome is Typed, and none when it isn't.`;
  }

  public static formatRunEndWithCode(path: string): string {
    return `${path} must give an exitCode only when endedBy is Command.`;
  }

  public static formatRunEndsUntyped(path: string): string {
    return `${path} must give endedRuns only when its outcome is Typed.`;
  }

  public static formatNotColor(name: string): string {
    return `${name} must be ${Resources.defaultColor}, a palette color from 0 to ${Resources.paletteSize - 1} or an RGB color from ${Resources.rgbColor} to ${Resources.maximumColor}.`;
  }
}
