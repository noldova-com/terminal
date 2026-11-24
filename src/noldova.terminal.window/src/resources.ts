/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalRunOutcome, TerminalShellKind, TerminalTextStyle, type TerminalCompletionKind } from "@noldova/terminal.protocol";
import type { IFunctionIdentifier } from "@xterm/xterm";

import type { CommandTokenKind } from "./app/enums/command-token-kind.ts";
import type { AnsiColor } from "./app/types/ansi-color.ts";
import type { AnsiKey } from "./app/types/ansi-key.ts";

export class Resources {
  public static readonly moduleId: string = "terminal";
  public static readonly commandPrefix: string = `${Resources.moduleId}.`;
  public static readonly sessionView: string = "terminal.session";
  public static readonly panelView: string = "terminal.panel";
  public static readonly newCommand: string = "terminal.new";
  public static readonly panelTitle: string = "Terminal";
  public static readonly panelIcon: string = "terminal";
  public static readonly shellKindIcons: Readonly<Record<TerminalShellKind, string>> = {
    [TerminalShellKind.PowerShell]: "terminal",
    [TerminalShellKind.CommandPrompt]: "chevron_right",
    [TerminalShellKind.Bash]: "attach_money",
    [TerminalShellKind.Zsh]: "percent",
    [TerminalShellKind.Fish]: "set_meal",
    [TerminalShellKind.Wsl]: "deployed_code",
    [TerminalShellKind.Other]: "terminal"
  };
  public static readonly newTitle: string = "New Terminal";
  public static readonly newIcon: string = "add";
  public static readonly newKey: string = "Ctrl+Shift+Backquote";
  public static readonly newWithShellCommand: string = "terminal.newWithShell";
  public static readonly newWithShellTitle: string = "New Terminal with Shell";
  public static readonly toggleCommand: string = "terminal.toggle";
  public static readonly toggleTitle: string = "Toggle Terminal";
  public static readonly toggleIcon: string = "terminal";
  public static readonly toggleKey: string = "Ctrl+Backquote";
  public static readonly tabRowPlace: string = "terminal.tabRow";
  public static readonly shellListGroup: string = "terminal.shellList";
  public static readonly defaultShellSetting: string = "terminal.defaultShell";
  public static readonly outputLimitSetting: string = "terminal.outputLimit";
  public static readonly fontSizeSetting: string = "terminal.fontSize";
  public static readonly systemDefaultShell: string = "System default";
  public static readonly folderArgument: string = "folder";
  public static readonly shellIdArgument: string = "shellId";
  public static readonly tabGroupArgument: string = "tabGroup";
  public static readonly ownerArgument: string = "owner";
  public static readonly titleArgument: string = "title";
  public static readonly minimumRowsArgument: string = "minimumRows";
  public static readonly environmentArgument: string = "environment";
  public static readonly noticeArgument: string = "notice";
  public static readonly commandArgument: string = "command";
  public static readonly shellKindsArgument: string = "shellKinds";
  public static readonly contextArgument: string = "context";
  public static readonly sessionIdArgument: string = "sessionId";
  public static readonly runIdArgument: string = "runId";
  public static readonly whenBusyArgument: string = "whenBusy";
  public static readonly terminalPartInactive: string = "the terminal's window part isn't active in this window.";
  public static readonly runNotTypedReasons: Readonly<Record<TerminalRunOutcome, string>> = {
    [TerminalRunOutcome.Typed]: "they were typed.",
    [TerminalRunOutcome.Input]: "the person typed in it, or its prompt line held text, before they went in.",
    [TerminalRunOutcome.Tab]: "they hold a tab, which its shell would take as completion.",
    [TerminalRunOutcome.Ended]: "it ended, closed or restarted first.",
    [TerminalRunOutcome.Busy]: "its shell was busy, running a command or with text on its prompt line, and stayed so.",
    [TerminalRunOutcome.NoShell]: "no shell of the run's kinds is installed."
  };
  public static readonly shellKindNames: Readonly<Record<TerminalShellKind, string>> = {
    [TerminalShellKind.PowerShell]: "PowerShell",
    [TerminalShellKind.CommandPrompt]: "Command Prompt",
    [TerminalShellKind.Bash]: "Bash",
    [TerminalShellKind.Zsh]: "Zsh",
    [TerminalShellKind.Fish]: "fish",
    [TerminalShellKind.Wsl]: "WSL",
    [TerminalShellKind.Other]: "other"
  };
  public static readonly takesNewOwnerArgument: string = "takesNewOwner";
  public static readonly ownerTakenTwice: string = "The value can't come with an owner.";
  public static readonly shellIdRequired: string = "New Terminal with Shell needs a shell id.";
  public static readonly ownersProvided: string = "This window already has an owners provider; remove it before providing another.";
  public static readonly restartCommand: string = "terminal.restartShell";
  public static readonly restartTitle: string = "Restart Terminal";
  public static readonly restartIcon: string = "refresh";
  public static readonly tabArgument: string = "tab";
  public static readonly tabKeySeparator: string = "/";
  public static readonly viewTabKind: string = "view";
  public static readonly startFolderName: string = "startFolder";
  public static readonly startFolderProvided: string = "This window already has a start folder provider; unregister it before providing another.";
  public static readonly startAgain: string = "Start again";
  public static readonly restart: string = "Restart";
  public static readonly ended: string = "The shell exited without an exit code.";
  public static readonly closed: string = "The terminal was closed.";
  public static readonly fontFamily: string = "\"Noldova Mono\", ui-monospace, \"Cascadia Mono\", Consolas, monospace";
  public static readonly fontFamilyToken: string = "--nol-font-mono";
  public static readonly cursorToken: string = "--nol-terminal-cursor";
  public static readonly accentToken: string = "--nol-accent";
  public static readonly selectionToken: string = "--nol-terminal-selection";
  public static readonly selectionForegroundToken: string = "--nol-terminal-selection-foreground";
  public static readonly selectedToken: string = "--nol-selected";
  public static readonly backgroundToken: string = "--nol-terminal-background";
  public static readonly scrollbarSizeToken: string = "--nol-scrollbar-size";
  public static readonly hiddenColor: string = "#00000000";
  public static readonly unpaintedPattern: RegExp = /^rgba\((?:[^,]+,){3}\s*0\)$|\/\s*0\)$/;
  public static readonly defaultFontSize: number = 13;
  public static readonly lineHeight: number = 1.3;
  public static readonly minimumContrastRatio: number = 4.5;
  public static readonly scrollback: number = 10_000;
  public static readonly storedPageLines: number = 500;
  public static readonly modesTail: RegExp = /(?:\u001b\[\??\d+[hl])*$/u;
  public static readonly applicationCursorKeysOn: string = "\u001b[?1h";
  public static readonly applicationKeypadOn: string = "\u001b[?66h";
  public static readonly bracketedPasteOn: string = "\u001b[?2004h";
  public static readonly inputModes: RegExp = /\u001b\[\?(?:1|9|66|1000|1002|1003|1004|2004)h/gu;
  public static readonly storedLinesCap: number = 50_000;
  public static readonly wideCharacterStart: number = 0x1100;
  public static readonly wideCharacterCells: number = 2;
  public static readonly storedPages: number = Resources.storedLinesCap / Resources.storedPageLines;
  public static readonly storedPageNotAdjacent: string = "A page of stored lines joins the lines already loaded.";
  public static readonly noteAttributes: string = "\u001b[2;3m";
  public static readonly resetAttributes: string = "\u001b[0m";
  public static readonly lineBreak: string = "\r\n";
  public static readonly sgrReset: number = 0;
  public static readonly sgrForeground: number = 38;
  public static readonly sgrBackground: number = 48;
  public static readonly sgrPaletteColor: number = 5;
  public static readonly sgrRgbColor: number = 2;
  public static readonly styleParameters: readonly (readonly [TerminalTextStyle, number])[] = [
    [TerminalTextStyle.Bold, 1], [TerminalTextStyle.Dim, 2], [TerminalTextStyle.Italic, 3], [TerminalTextStyle.Underline, 4], [TerminalTextStyle.Blink, 5],
    [TerminalTextStyle.Inverse, 7], [TerminalTextStyle.Invisible, 8], [TerminalTextStyle.Strikethrough, 9], [TerminalTextStyle.Overline, 53]
  ];
  public static readonly maximumTitleLength: number = 200;
  public static readonly maximumMinimumRows: number = 100;
  public static readonly openingColumns: number = 80;
  public static readonly openingRows: number = 24;
  public static readonly escape: string = "\u001b";
  public static readonly copyKey: string = "c";
  public static readonly conptyBackend: "conpty" = "conpty";
  public static readonly contextLost: string = "The terminal's WebGL context was lost, so it draws with the DOM renderer.";
  public static readonly allowedLinkProtocols: readonly string[] = ["http:", "https:", "mailto:"];
  public static readonly linkOpeningButton: number = 0;
  public static readonly maximumLinkLength: number = 2_048;
  public static readonly linkScanLength: number = 2 * Resources.maximumLinkLength;
  public static readonly emptyCellText: string = " ";
  public static readonly plainLinkPattern: RegExp = /\b(?:https?:\/\/|mailto:)[^\s"'<>`]+[^\s"'<>`.,;:!?)\]}]/g;
  public static readonly colorTokenPrefix: string = "--nol-terminal-ansi-";
  public static readonly darkScheme: string = "dark";
  public static readonly lightCursorAccent: string = "#ffffff";
  public static readonly darkCursorAccent: string = "#000000";
  public static readonly darkPaletteQuery: string = "(prefers-color-scheme: dark)";
  public static readonly darkInactiveSelectionOpacity: number = 0.7;
  public static readonly lightInactiveSelectionOpacity: number = 0.65;
  public static readonly computedColorPattern: RegExp = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/u;
  public static readonly themeObservedAttributes: readonly string[] = ["style", "class"];
  public static readonly pasteEvent: "paste" = "paste";
  public static readonly focusInEvent: string = "focusin";
  public static readonly alternateBuffer: string = "alternate";
  public static readonly xtermScreenSelector: string = ".xterm-screen";
  public static readonly embeddedTerminalTag: string = "nol-embedded-terminal";
  public static readonly terminalPaneTag: string = "nol-terminal-pane";
  public static readonly terminalNotActive: string = "Terminal isn't active in this window.";
  public static readonly changeEvent: string = "change";
  public static readonly visibilityChangeEvent: string = "visibilitychange";
  public static readonly hiddenVisibility: DocumentVisibilityState = "hidden";
  public static readonly reducedMotionQuery: string = "(prefers-reduced-motion: reduce)";
  public static readonly forcedColorsQuery: string = "(forced-colors: active)";
  public static readonly keyDownEvent: string = "keydown";
  public static readonly suggestionKeys: readonly string[] = ["ArrowRight", "End"];
  public static readonly plainInput: RegExp = /^[^\u0000-\u001f\u007f]+$/u;
  public static readonly inputQuietMilliseconds: number = 100;
  public static readonly inputLostMilliseconds: number = 1_000;
  public static readonly suggestionClass: string = "nol-terminal-suggestion";
  public static readonly spanTag: string = "span";
  public static readonly plainTextType: string = "text/plain";
  public static readonly answeredQueries: readonly IFunctionIdentifier[] = [
    { final: "n" },
    { prefix: "?", final: "n" },
    { final: "c" },
    { prefix: ">", final: "c" },
    { prefix: "=", final: "c" },
    { intermediates: "$", final: "p" },
    { prefix: "?", intermediates: "$", final: "p" }
  ];
  public static readonly answeredSettingQuery: IFunctionIdentifier = { intermediates: "$", final: "q" };
  /** The OSC color codes xterm answers a query of itself: the palette (4), the foreground (10), the background (11) and the cursor (12). */
  public static readonly colorQueryCodes: readonly number[] = [4, 10, 11, 12];
  public static readonly colorQueryMark: string = "?";
  public static readonly commandColorsSetting: string = "terminal.commandColors";
  public static readonly completionListSetting: string = "terminal.completionList";
  public static readonly linkClickSetting: string = "terminal.linkClick";
  public static readonly completeKey: string = "Tab";
  public static readonly completionMoveKeys: readonly string[] = ["ArrowUp", "ArrowDown"];
  public static readonly completionInsertKeys: readonly string[] = ["Tab", "Enter"];
  public static readonly completionCloseKey: string = "Escape";
  public static readonly backspaceKey: string = "Backspace";
  public static readonly composingKey: string = "Process";
  public static readonly modifierKeys: readonly string[] = ["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock"];
  public static readonly tabInput: string = "\t";
  public static readonly eraseInput: string = "\u007f";
  public static readonly blurEvent: string = "blur";
  public static readonly completionListClass: string = "nol-completion-list";
  public static readonly completionClass: string = "nol-completion-option";
  public static readonly completionLabelClass: string = "nol-completion-label";
  public static readonly completionKindClass: string = "nol-completion-note";
  public static readonly completionListInputs: { readonly choices: string; readonly active: string; readonly listId: string; readonly label: string;
    readonly isCode: string; readonly maxHeight: string } = { choices: "choices", active: "active", listId: "listId", label: "label", isCode: "isCode",
    maxHeight: "maxHeight" };
  public static readonly completionsLabel: string = "Completions";
  public static readonly activeDescendantAttribute: string = "aria-activedescendant";
  public static readonly controlsAttribute: string = "aria-controls";
  public static readonly expandedAttribute: string = "aria-expanded";
  public static readonly autocompleteAttribute: string = "aria-autocomplete";
  public static readonly listAutocomplete: string = "list";
  public static readonly completionKinds: Readonly<Record<TerminalCompletionKind, string>> = {
    File: "File",
    Folder: "Folder",
    Command: "Command",
    Branch: "Branch",
    Script: "Script",
    Option: "Option"
  };
  public static readonly commandColorTokens: Readonly<Record<CommandTokenKind, string>> = {
    Command: "--nol-code-function",
    NotFound: "--nol-error",
    Keyword: "--nol-code-control",
    Option: "--nol-code-keyword",
    String: "--nol-code-string",
    Path: "--nol-code-type",
    Variable: "--nol-code-variable",
    Operator: "--nol-code-control",
    Comment: "--nol-code-comment"
  };
  public static readonly hexColorPattern: RegExp = /^#[\da-f]{6}$/iu;
  public static readonly commandBlanks: string = " \t";
  public static readonly askedCommandPattern: RegExp = /^[\p{L}\p{N}._+@%:,-]+$/u;
  public static readonly commandLineBreak: string = "\n";
  public static readonly hereDocumentOperator: string = "<<";
  public static readonly hereStringOperator: string = "<<<";
  public static readonly hereDocumentTabsOption: string = "-";
  public static readonly hereDocumentIndentPattern: RegExp = /^[ \t]+/u;
  public static readonly delimiterQuotingPattern: RegExp = /["'\\]/gu;
  public static readonly posixOperators: string = "|&;()<>";
  public static readonly powerShellOperators: string = "|&;(){}<>";
  public static readonly posixEscape: string = "\\";
  public static readonly powerShellEscape: string = "`";
  public static readonly singleQuote: string = "'";
  public static readonly doubleQuote: string = "\"";
  public static readonly commentStart: string = "#";
  public static readonly blockEnd: string = "}";
  public static readonly variableStart: string = "$";
  public static readonly subexpressionStart: string = "$(";
  public static readonly optionStart: string = "-";
  public static readonly homeStart: string = "~";
  public static readonly currentFolderStart: string = ".";
  public static readonly posixSeparators: string = "/";
  public static readonly powerShellSeparators: string = "/\\";
  public static readonly redirectionPattern: RegExp = /[<>]/u;
  public static readonly commandOpeningPattern: RegExp = /[|&;({]/u;
  public static readonly redirectionStartPattern: RegExp = /\d+(?=[<>])/uy;
  public static readonly duplicatedStreamPattern: RegExp = /\d+|-/uy;
  public static readonly posixAssignmentPattern: RegExp = /^[A-Za-z_][A-Za-z0-9_]*\+?=/u;
  public static readonly posixVariablePattern: RegExp = /\$(?:\{[^}]*\}?|[A-Za-z_][A-Za-z0-9_]*|[0-9?$#@!*-])/uy;
  public static readonly powerShellVariablePattern: RegExp = /\$(?:\{[^}]*\}?|[A-Za-z_][A-Za-z0-9_]*(?::[A-Za-z_][A-Za-z0-9_]*)?|[?$^_])/uy;
  public static readonly posixKeywords: readonly string[] = ["if", "then", "else", "elif", "fi", "do", "done", "while", "until", "for", "in", "case",
    "esac", "select", "function", "time", "{", "}", "!", "[[", "]]", "coproc"];
  public static readonly posixCommandKeywords: readonly string[] = ["if", "then", "else", "elif", "do", "while", "until", "time", "{", "!"];
  public static readonly zshKeywords: readonly string[] = ["repeat", "foreach", "end", "always"];
  public static readonly zshLoopKeywords: readonly string[] = ["for", "foreach"];
  public static readonly listStart: string = "(";
  public static readonly listEnd: string = ")";
  public static readonly zshAlwaysKeyword: string = "always";
  public static readonly zshRepeatKeyword: string = "repeat";
  public static readonly loopListKeyword: string = "in";
  public static readonly targetedRedirectionPattern: RegExp = /[<>|&]$/u;
  public static readonly precommandValueOptions: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([["exec", ["-a"]]]);
  public static readonly posixPrecommandModifiers: readonly string[] = ["builtin", "command", "exec"];
  public static readonly zshPrecommandModifiers: readonly string[] = ["-", "noglob", "nocorrect"];
  public static readonly zshDisownOperator: string = "&!";
  public static readonly zshEqualsPattern: RegExp = /^=[\p{L}\p{N}._+-]/u;
  public static readonly powerShellKeywords: readonly string[] = ["begin", "break", "catch", "class", "continue", "data", "do", "dynamicparam",
    "else", "elseif", "end", "enum", "exit", "filter", "finally", "for", "foreach", "function", "if", "in", "param", "process", "return", "switch",
    "throw", "trap", "try", "until", "using", "while"];
  public static readonly launchMinimumRowsWithoutTab: string = "minimumRows needs the launch's tab; an embedded terminal takes its rows from EmbeddedTerminal.open.";
  public static readonly copyRefused: string = "the clipboard refused the text.";
  public static readonly macPlatformPrefix: string = "Mac";
  public static readonly windowsPlatformPrefix: string = "Win";
  public static readonly pageArgument: string = "page";
  public static readonly commandWordSeparator: string = " ";
  public static readonly commandSpanFieldSeparator: string = ",";
  public static readonly commandColorDecorationLayer: "bottom" = "bottom";
  public static readonly duplicateOutputOperator: string = ">&";
  public static readonly duplicateInputOperator: string = "<&";
  public static readonly suggestionDecorationLayer: "top" = "top";
  public static readonly nonBlankPattern: RegExp = /\S/u;
  public static readonly embeddedDisplay: string = "block";
  public static readonly embeddedOverflow: string = "hidden";
  public static readonly sessionIdInput: string = "sessionId";
  public static readonly isRestartableInput: string = "isRestartable";
  public static readonly fixedRowsInput: string = "fixedRows";
  public static readonly isFocusedOnOpenInput: string = "isFocusedOnOpen";
  public static readonly scrollEvent: string = "scroll";
  public static readonly focusEvent: string = "focus";
  public static readonly scrollbarRangeTag: string = "div";
  public static readonly redShift: number = 16;
  public static readonly greenShift: number = 8;
  public static readonly channelMask: number = 0xff;
  public static readonly defaultRunLines: number = 2_000;
  public static readonly keptEarlyRunEnds: number = 64;
  public static readonly brightBlackColor: AnsiColor = "bright-black";
  public static readonly ansiColors: readonly (readonly [AnsiKey, AnsiColor])[] = [
    ["black", "black"], ["red", "red"], ["green", "green"], ["yellow", "yellow"], ["blue", "blue"], ["magenta", "magenta"], ["cyan", "cyan"],
    ["white", "white"], ["brightBlack", "bright-black"], ["brightRed", "bright-red"], ["brightGreen", "bright-green"], ["brightYellow", "bright-yellow"],
    ["brightBlue", "bright-blue"], ["brightMagenta", "bright-magenta"], ["brightCyan", "bright-cyan"], ["brightWhite", "bright-white"]
  ];
  public static readonly unforcedColorAdjust: string = "none";
  public static readonly probePosition: string = "absolute";
  public static readonly probeVisibility: string = "hidden";
  public static readonly opaqueAlpha: number = 1;

  public static formatEmbeddedHeight(rowsHeight: number): string {
    return `calc(${rowsHeight}px + 0.75rem)`;
  }

  public static formatEmbeddedRowsRefused(rows: number, minimum: number, maximum: number): string {
    return `An embedded terminal's rows must be a whole number from ${minimum} to ${maximum}, not ${rows}.`;
  }

  public static formatLaunchRefused(reason: string): string {
    return `The terminal wasn't launched, and nothing opened: ${reason}`;
  }

  public static formatRunRefused(reason: string): string {
    return `The commands weren't run, and nothing opened: ${reason}`;
  }

  public static formatNoShellOfKinds(kinds: readonly TerminalShellKind[]): string {
    const names: readonly string[] = kinds.map(t => Resources.shellKindNames[t]);
    const listed: string = names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} or ${names.slice(-1).join("")}`;
    return `no shell of the kinds they need is installed (${listed}).`;
  }

  public static formatRunNotFound(sessionId: string, runId: string): string {
    return `Terminal ${sessionId} has no run ${runId} whose output it can give.`;
  }

  public static formatRunLinesRefused(lines: number, maximum: number): string {
    return `A run's output can be read up to a whole number from 1 to ${maximum} of lines, not ${lines}.`;
  }

  public static formatRunNotTyped(sessionId: string, outcome: TerminalRunOutcome): string {
    return `The commands weren't typed into terminal ${sessionId}: ${Resources.runNotTypedReasons[outcome]}`;
  }

  public static formatLaunchMinimumRowsRefused(maximum: number): string {
    return `minimumRows must be a whole number from 1 to ${maximum}.`;
  }

  public static formatLaunchTitleRefused(maximum: number): string {
    return `title must not be blank and must have at most ${maximum} characters.`;
  }

  public static formatLaunchFolderMissing(folder: string): string {
    return `folder ${folder} doesn't exist.`;
  }

  public static formatNewOwnerFailed(reason: string): string {
    return `The terminal opened without an owner instead of the app's new owner: ${reason}`;
  }

  public static formatNewOwnerHidden(owner: string): string {
    return `The terminal opened for the app's new owner ${owner}, which the window doesn't show, so it has no tab until that owner shows.`;
  }

  public static formatClosedFailed(error: unknown): string {
    return `A terminal's tab closed by its owner could not be closed: ${Resources.describe(error)}`;
  }

  public static formatRenameFailed(error: unknown): string {
    return `A terminal could not be renamed: ${Resources.describe(error)}`;
  }

  public static formatRetitleFailed(error: unknown): string {
    return `A renamed terminal's tab could not be retitled: ${Resources.describe(error)}`;
  }

  public static formatOwnedOpenFailed(error: unknown): string {
    return `An agent's terminal opened for an owner could not get its tab: ${Resources.describe(error)}`;
  }

  public static formatStartFolderFailed(reason: string): string {
    return `The terminal opened in the home folder instead of the app's start folder: ${reason}`;
  }

  public static formatDefaultShellRow(name: string): string {
    return `${name} (default)`;
  }

  public static formatSystemDefaultShell(name: string): string {
    return `${Resources.systemDefaultShell} (${name})`;
  }

  public static formatRunListFailed(error: unknown): string {
    return `The terminals could not be listed after a run that ended, so its terminal got no tab: ${Resources.describe(error)}`;
  }

  public static formatEventUnread(event: string, error: unknown): string {
    return `The window dropped a ${event} event it could not read: ${Resources.describe(error)}`;
  }

  public static formatShellsFailed(error: unknown): string {
    return `The shells could not be listed, so the shell menu and the Default shell setting offer none: ${Resources.describe(error)}`;
  }

  public static formatExit(exitCode: number | null): string {
    return exitCode === null ? Resources.ended : `The shell exited with code ${exitCode}.`;
  }

  public static formatCloseFailed(error: unknown): string {
    return `The terminal's shell could not be ended when its tab closed: ${Resources.describe(error)}`;
  }

  public static formatWindowStartFailed(error: unknown): string {
    return `The terminals this window launched without a tab before it reloaded could not be ended: ${Resources.describe(error)}`;
  }

  public static formatShowOwnerFailed(error: unknown): string {
    return `The runtime could not be told which owner's terminals this window shows: ${Resources.describe(error)}`;
  }

  public static formatRestoreFailed(error: unknown): string {
    return `The terminals the last run left open could not be opened again: ${Resources.describe(error)}`;
  }

  public static formatTabShellsFailed(error: unknown): string {
    return `The terminal tabs show no shell names, since the terminals could not be listed: ${Resources.describe(error)}`;
  }

  public static formatReopenFailed(error: unknown): string {
    return `The terminal tabs could not be reopened, so their shells keep running without a tab: ${Resources.describe(error)}`;
  }

  public static formatSuggestionsUnread(error: unknown): string {
    return `The terminal's Suggestions setting could not be read, so the terminal suggests earlier commands: ${Resources.describe(error)}`;
  }

  public static formatCommandColorsUnread(error: unknown): string {
    return `The terminal's Command colors setting could not be read, so the terminal leaves typed commands uncolored: ${Resources.describe(error)}`;
  }

  public static formatCommandLookupFailed(error: unknown): string {
    return `The terminal could not look up typed commands, so it colors them without telling whether they exist: ${Resources.describe(error)}`;
  }

  public static formatCompletionListUnread(error: unknown): string {
    return `The terminal's Completion list setting could not be read, so Tab opens the list: ${Resources.describe(error)}`;
  }

  public static formatCompletionFailed(error: unknown): string {
    return `The terminal could not list completions, so it sent Tab to the shell: ${Resources.describe(error)}`;
  }

  public static formatFontSizeUnread(error: unknown): string {
    return `The terminal's Font size setting could not be read, so the terminal draws at its default ${Resources.defaultFontSize} pixels: ${Resources.describe(error)}`;
  }

  public static formatDefaultShellFailed(shellId: string, error: unknown): string {
    return `The Default shell ${shellId} could not open, so the terminal opens with the system default shell: ${Resources.describe(error)}`;
  }

  public static formatShellOpenFailed(shellId: string, error: unknown): string {
    return `A terminal could not open with the shell ${shellId}, so the shell menu lists the shells again: ${Resources.describe(error)}`;
  }

  public static formatOpenFailed(error: unknown): string {
    return `The terminal could not start: ${Resources.describe(error)}`;
  }

  public static formatWebglFailed(error: unknown): string {
    return `The terminal draws with the DOM renderer, since WebGL failed: ${Resources.describe(error)}`;
  }

  public static formatRequestFailed(method: string, error: unknown): string {
    return `${method} failed: ${Resources.describe(error)}`;
  }

  public static formatDrawFailed(error: unknown): string {
    return `The terminal's screen could not be drawn, so the pane shows it as lost: ${Resources.describe(error)}`;
  }

  public static formatFontFailed(error: unknown): string {
    return `The terminal's font did not load, so it measures the font it has: ${Resources.describe(error)}`;
  }

  public static formatLinkFailed(error: unknown): string {
    return `Opening the link failed: ${Resources.describe(error)}`;
  }

  public static formatCopyFailed(error: unknown): string {
    return `Copying the selection failed: ${Resources.describe(error)}`;
  }

  public static formatPagingFailed(error: unknown): string {
    return `Paging the terminal's stored lines failed: ${Resources.describe(error)}`;
  }

  public static formatDroppedLines(count: number): string {
    return count === 1 ? "1 older line was dropped" : `${count.toLocaleString("en-US")} older lines were dropped`;
  }

  public static formatSgr(parameters: readonly number[]): string {
    return `\u001b[${parameters.join(";")}m`;
  }

  public static formatFont(size: number, family: string): string {
    return `${size}px ${family}`;
  }

  public static formatPixels(size: number): string {
    return `${size}px`;
  }

  public static formatShownAt(row: number, column: number, written: number, columns: number): string {
    return `${row}:${column}:${written}:${columns}`;
  }

  public static formatSizeVariable(token: string): string {
    return `var(${token}, 0px)`;
  }

  public static formatRgba(red: string | undefined, green: string | undefined, blue: string | undefined, alpha: number): string {
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  private static describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
