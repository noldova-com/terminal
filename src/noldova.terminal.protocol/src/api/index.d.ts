/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ArgumentException, ArgumentOutOfRangeException, Exception, ExceptionOptions } from "@noldova/context.exceptions";
import type { JsonException, JsonObject } from "@noldova/context.json";

/**
 * How a terminal's shell ended.
 *
 * @example
 * ```ts
 * import { EndedBy, TerminalExit } from "@noldova/terminal.protocol";
 *
 * const exit = new TerminalExit(0, EndedBy.Exit);
 * console.log(exit.endedBy === EndedBy.Exit);
 * ```
 */
export declare const EndedBy: {
  /**
   * The shell exited by itself, wire value `"Exit"`.
   */
  readonly Exit: "Exit";

  /**
   * The runtime ended the shell, as closing the terminal or restarting its shell does, wire value `"Close"`.
   */
  readonly Close: "Close";
};

/**
 * One of {@link EndedBy}'s wire values: `"Exit"` or `"Close"`.
 */
export type EndedBy = (typeof EndedBy)[keyof typeof EndedBy];

/**
 * What a {@link TerminalCompletionItem} is, which the list shows as its icon.
 *
 * @example
 * ```ts
 * import { TerminalCompletionItem, TerminalCompletionKind } from "@noldova/terminal.protocol";
 *
 * console.log(new TerminalCompletionItem("src/", "src/", TerminalCompletionKind.Folder).toJson());
 * ```
 */
export declare const TerminalCompletionKind: {
  /**
   * A file, wire value `"File"`.
   */
  readonly File: "File";

  /**
   * A folder, wire value `"Folder"`; its text ends with the separator the line uses, and leaves an open quote open.
   */
  readonly Folder: "Folder";

  /**
   * A program on the shell's PATH or one of the shell's builtins, wire value `"Command"`.
   */
  readonly Command: "Command";

  /**
   * A git branch, local or remote, wire value `"Branch"`.
   */
  readonly Branch: "Branch";

  /**
   * A script of the nearest `package.json`, wire value `"Script"`.
   */
  readonly Script: "Script";

  /**
   * One of the command's options, as the shell's own completers give it, wire value `"Option"`.
   */
  readonly Option: "Option";
};

/**
 * One of {@link TerminalCompletionKind}'s wire values: `"File"`, `"Folder"`, `"Command"`, `"Branch"`, `"Script"` or `"Option"`.
 */
export type TerminalCompletionKind = (typeof TerminalCompletionKind)[keyof typeof TerminalCompletionKind];

/**
 * An edge of the shell's line for the person's command, as a {@link TerminalInputMark} gives it in a {@link TerminalOutput}.
 *
 * @example
 * ```ts
 * import { TerminalInputEdge, TerminalInputMark } from "@noldova/terminal.protocol";
 *
 * console.log(new TerminalInputMark(2, TerminalInputEdge.Start).toJson());
 * ```
 */
export declare const TerminalInputEdge: {
  /**
   * The line starts: the shell integration marked its prompt's end, wire value `"Start"`.
   */
  readonly Start: "Start";

  /**
   * The line ends: the shell left its prompt, at a prompt's or a command's start or its end, or the shell restarted, wire value `"End"`.
   */
  readonly End: "End";

  /**
   * The prompt's right part starts here on the line's row, as zsh's right prompt does: the shell integration marked it, wire value
   * `"RightPrompt"`. Text from there on is the prompt's, not the person's line.
   */
  readonly RightPrompt: "RightPrompt";

  /**
   * The line goes on here, on a later row, after the continuation prompt of a command over several lines, as bash's `PS2` and zsh's `PROMPT2`
   * draw it: the shell integration marked the continuation prompt's end, wire value `"Continuation"`.
   */
  readonly Continuation: "Continuation";
};

/**
 * One of {@link TerminalInputEdge}'s wire values: `"Start"`, `"End"`, `"RightPrompt"` or `"Continuation"`.
 */
export type TerminalInputEdge = (typeof TerminalInputEdge)[keyof typeof TerminalInputEdge];

/**
 * What a run into a given terminal, a {@link TerminalRunParams} with a session ID, does when that terminal's shell is busy: running a
 * command, or with text on its prompt line.
 *
 * @example
 * ```ts
 * import { TerminalRunBusy, TerminalRunParams, TerminalSize } from "@noldova/terminal.protocol";
 *
 * const request = new TerminalRunParams("example.chat/42", "npm test", null, [], null, new TerminalSize(80, 24), undefined, "session-1",
 *   TerminalRunBusy.Interrupt);
 * console.log(request.whenBusy);
 * ```
 */
export declare const TerminalRunBusy: {
  /**
   * The run types nothing and answers {@link TerminalRunOutcome.Busy}, wire value `"Refuse"`.
   */
  readonly Refuse: "Refuse";

  /**
   * The run waits up to 2 seconds for a command to start, sends it Ctrl+C, waits up to 2 seconds more for the shell to be back at an empty
   * prompt, then types; it answers {@link TerminalRunOutcome.Busy} when the shell isn't back in time, wire value `"Interrupt"`.
   */
  readonly Interrupt: "Interrupt";
};

/**
 * One of {@link TerminalRunBusy}'s wire values: `"Refuse"` or `"Interrupt"`.
 */
export type TerminalRunBusy = (typeof TerminalRunBusy)[keyof typeof TerminalRunBusy];

/**
 * What became of a run's commands, which a {@link TerminalRunResult} gives.
 *
 * @example
 * ```ts
 * import { TerminalRunOutcome, TerminalRunResult } from "@noldova/terminal.protocol";
 *
 * console.log(new TerminalRunResult("session-1", TerminalRunOutcome.Typed, "run-1").outcome);
 * ```
 */
export declare const TerminalRunOutcome: {
  /**
   * The runtime typed the commands, wire value `"Typed"`.
   */
  readonly Typed: "Typed";

  /**
   * Nothing was typed: the person typed in the terminal after the run picked it, or its prompt line held text when the commands would have
   * gone in, wire value `"Input"`.
   */
  readonly Input: "Input";

  /**
   * Nothing was typed: the commands hold a tab, which a shell that hasn't turned bracketed paste on takes as completion, wire value `"Tab"`.
   */
  readonly Tab: "Tab";

  /**
   * Nothing was typed: the terminal's shell ended, or the terminal closed or restarted, first, wire value `"Ended"`.
   */
  readonly Ended: "Ended";

  /**
   * Nothing opened or was typed: no shell of the run's kinds is installed, so the answer names no terminal, wire value `"NoShell"`.
   */
  readonly NoShell: "NoShell";

  /**
   * Nothing was typed: the run's given terminal was busy and stayed so, as its {@link TerminalRunBusy} says, or another run into it was
   * still starting, wire value `"Busy"`.
   */
  readonly Busy: "Busy";
};

/**
 * One of {@link TerminalRunOutcome}'s wire values: `"Typed"`, `"Input"`, `"Tab"`, `"Ended"`, `"NoShell"` or `"Busy"`.
 */
export type TerminalRunOutcome = (typeof TerminalRunOutcome)[keyof typeof TerminalRunOutcome];

/**
 * How a run's commands ended, which a {@link TerminalRunEnded} gives.
 *
 * @example
 * ```ts
 * import { TerminalRunEnded, TerminalRunEndedBy } from "@noldova/terminal.protocol";
 *
 * console.log(new TerminalRunEnded("session-1", "run-1", TerminalRunEndedBy.Command, 0).endedBy);
 * ```
 */
export declare const TerminalRunEndedBy: {
  /**
   * The shell marked the end of the run's last command, wire value `"Command"`.
   */
  readonly Command: "Command";

  /**
   * The shell has no integration to mark a command's end, such as Command Prompt, fish or WSL, so the end can't be told; the runtime knows it
   * as it types the run, wire value `"NoIntegration"`.
   */
  readonly NoIntegration: "NoIntegration";

  /**
   * The terminal's shell exited or restarted, the terminal closed, or the runtime ended, before the run's last command ended, wire value
   * `"TerminalEnded"`.
   */
  readonly TerminalEnded: "TerminalEnded";
};

/**
 * One of {@link TerminalRunEndedBy}'s wire values: `"Command"`, `"NoIntegration"` or `"TerminalEnded"`.
 */
export type TerminalRunEndedBy = (typeof TerminalRunEndedBy)[keyof typeof TerminalRunEndedBy];

/**
 * What kind of shell a {@link TerminalShell} is, which a window shows as its icon.
 *
 * @example
 * ```ts
 * import { TerminalShell, TerminalShellKind } from "@noldova/terminal.protocol";
 *
 * const shell = new TerminalShell("git-bash", "Git Bash", TerminalShellKind.Bash, false);
 * console.log(shell.kind === TerminalShellKind.Bash);
 * ```
 */
export declare const TerminalShellKind: {
  /**
   * PowerShell, also Windows PowerShell, wire value `"PowerShell"`.
   */
  readonly PowerShell: "PowerShell";

  /**
   * Windows' Command Prompt, wire value `"CommandPrompt"`.
   */
  readonly CommandPrompt: "CommandPrompt";

  /**
   * Bash, also Git Bash, wire value `"Bash"`.
   */
  readonly Bash: "Bash";

  /**
   * Zsh, wire value `"Zsh"`.
   */
  readonly Zsh: "Zsh";

  /**
   * Fish, wire value `"Fish"`.
   */
  readonly Fish: "Fish";

  /**
   * A Windows Subsystem for Linux distribution's shell, wire value `"Wsl"`.
   */
  readonly Wsl: "Wsl";

  /**
   * Any other shell, wire value `"Other"`.
   */
  readonly Other: "Other";
};

/**
 * One of {@link TerminalShellKind}'s wire values: `"PowerShell"`, `"CommandPrompt"`, `"Bash"`, `"Zsh"`, `"Fish"`, `"Wsl"` or `"Other"`.
 */
export type TerminalShellKind = (typeof TerminalShellKind)[keyof typeof TerminalShellKind];

/**
 * The style flags of a stored line's text run; a run's {@link TerminalTextRun.style} is the sum of its flags.
 *
 * @example
 * ```ts
 * import { Resources, TerminalTextRun, TerminalTextStyle } from "@noldova/terminal.protocol";
 *
 * const style: number = TerminalTextStyle.Bold | TerminalTextStyle.Underline;
 * const run = new TerminalTextRun(5, Resources.defaultColor, Resources.defaultColor, style);
 * console.log((run.style & TerminalTextStyle.Bold) !== 0);
 * ```
 */
export declare const TerminalTextStyle: {
  /**
   * Bold text, flag `1`.
   */
  readonly Bold: 1;

  /**
   * Dim text, flag `2`.
   */
  readonly Dim: 2;

  /**
   * Italic text, flag `4`.
   */
  readonly Italic: 4;

  /**
   * Underlined text, flag `8`.
   */
  readonly Underline: 8;

  /**
   * Blinking text, flag `16`.
   */
  readonly Blink: 16;

  /**
   * Text with its foreground and background swapped, flag `32`.
   */
  readonly Inverse: 32;

  /**
   * Hidden text, flag `64`.
   */
  readonly Invisible: 64;

  /**
   * Struck-through text, flag `128`.
   */
  readonly Strikethrough: 128;

  /**
   * Overlined text, flag `256`.
   */
  readonly Overline: 256;
};

/**
 * One of {@link TerminalTextStyle}'s flags: `1`, `2`, `4`, `8`, `16`, `32`, `64`, `128` or `256`.
 */
export type TerminalTextStyle = (typeof TerminalTextStyle)[keyof typeof TerminalTextStyle];

/**
 * The base of every exception the package throws, which a caller can catch to handle any of them.
 *
 * @example
 * ```ts
 * import { PackageCopiesException, TerminalProtocolException } from "@noldova/terminal.protocol";
 *
 * console.log(new PackageCopiesException() instanceof TerminalProtocolException);
 * ```
 */
export declare class TerminalProtocolException extends Exception {
  /**
   * The class's name, `"TerminalProtocolException"`, which a subclass replaces with its own.
   */
  public override readonly name: string;

  /**
   * Creates the exception.
   *
   * @param message The reason.
   * @param options The options, such as the error that caused this one.
   *
   * @example
   * ```ts
   * import { ExceptionOptions } from "@noldova/context.exceptions";
   * import { TerminalProtocolException } from "@noldova/terminal.protocol";
   *
   * const cause = new Error("The stream closed.");
   * console.log(new TerminalProtocolException("The terminal protocol failed.", new ExceptionOptions(cause)).cause === cause);
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * Thrown when a check against one of the package's classes, such as `getService("terminal.owners", RuntimeTerminalOwners)`, meets an object
 * that another installed copy of the package made: the app and Terminal must install one copy, at Terminal's version.
 *
 * @example
 * ```ts
 * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
 * import { PackageCopiesException, RuntimeTerminalOwners } from "@noldova/terminal.protocol";
 *
 * export function readOwners(context: IRuntimePartContext): RuntimeTerminalOwners | null {
 *   try {
 *     return context.getService("terminal.owners", RuntimeTerminalOwners);
 *   }
 *   catch (error) {
 *     if (error instanceof PackageCopiesException)
 *       console.log(error.message);
 *     return null;
 *   }
 * }
 * ```
 */
export declare class PackageCopiesException extends TerminalProtocolException {
  /**
   * The class's name, `"PackageCopiesException"`, which logs show.
   */
  public override readonly name: string;

  /**
   * Creates the exception, with {@link Resources.runtimeOwnersCopies} as its message, which names the package and what to install.
   *
   * @example
   * ```ts
   * import { PackageCopiesException } from "@noldova/terminal.protocol";
   *
   * console.log(new PackageCopiesException().message);
   * ```
   */
  public constructor();
}

/**
 * The protocol's limits, wire constants and failure messages.
 *
 * @remarks
 * Lengths count UTF-16 code units, as a string's `length` does.
 * Output offsets count UTF-16 code units of the terminal's output, from its first output.
 */
export declare class Resources {
  /**
   * The JSON path of a message's root, `"$"`, which every {@link JsonException.path} starts with.
   */
  public static readonly rootPath: string;

  /**
   * The subject an argument refusal's message starts with, `"The value"`, since context's `ArgumentException` adds the parameter's name.
   */
  public static readonly valueSubject: string;

  /**
   * The fewest columns a terminal has, `1`.
   */
  public static readonly minimumColumns: number;

  /**
   * The most columns a terminal has, `1000`.
   */
  public static readonly maximumColumns: number;

  /**
   * The fewest rows a terminal has, `1`.
   */
  public static readonly minimumRows: number;

  /**
   * The most rows a terminal has, `1000`.
   */
  public static readonly maximumRows: number;

  /**
   * The longest session, pane or shell ID, `200`.
   */
  public static readonly maximumIdentifierLength: number;

  /**
   * The longest input one {@link TerminalInputParams} carries, `1048576`.
   */
  public static readonly maximumInputLength: number;

  /**
   * The longest output one {@link TerminalOutput} carries, and the longest pending tail of a {@link TerminalAttachment}, `1048576`.
   */
  public static readonly maximumOutputLength: number;

  /**
   * The longest screen snapshot of a {@link TerminalAttachment}, `16777216`.
   */
  public static readonly maximumSnapshotLength: number;

  /**
   * The longest folder path, `4096`.
   */
  public static readonly maximumPathLength: number;

  /**
   * What an absolute folder path starts with: `/` on Unix, a drive and a separator on Windows, or `\\` for a Windows share.
   */
  public static readonly absolutePathPattern: RegExp;

  /**
   * The longest terminal title, `4096`.
   */
  public static readonly maximumTitleLength: number;

  /**
   * The longest owner, `256`.
   */
  public static readonly maximumOwnerLength: number;

  /**
   * The key of the brand every {@link RuntimeTerminalOwners} carries, `Symbol.for("@noldova/terminal.protocol/RuntimeTerminalOwners")`,
   * which every installed copy of the package shares.
   */
  public static readonly runtimeOwnersBrand: string;

  /**
   * The message of the {@link PackageCopiesException} a check against {@link RuntimeTerminalOwners} throws for a service that another
   * installed copy of the package made.
   */
  public static readonly runtimeOwnersCopies: string;

  /**
   * The most variables a launched terminal takes, `256`.
   */
  public static readonly maximumVariables: number;

  /**
   * The longest variable name, `256`.
   */
  public static readonly maximumVariableNameLength: number;

  /**
   * The longest variable value, `32767`, the most Windows allows.
   */
  public static readonly maximumVariableValueLength: number;

  /**
   * The most UTF-16 code units a launched terminal's variables' names and values hold in all, `131072`, which leaves room for the environment
   * they lie over within the size a program's start takes on macOS and Linux.
   */
  public static readonly maximumEnvironmentLength: number;

  /**
   * A portable variable name: a letter or `_`, then letters, digits or `_`.
   */
  public static readonly variableNamePattern: RegExp;

  /**
   * The variables the terminal sets itself, which a launch can't give in any case: `TERM`, `COLORTERM` and `ZDOTDIR`.
   */
  public static readonly refusedVariables: readonly string[];

  /**
   * The start of the names the terminal's shell integration uses, which a launch can't give in any case, `"NOLDOVA_TERMINAL_"`.
   */
  public static readonly refusedVariablePrefix: string;

  /**
   * The longest notice, `4096`.
   */
  public static readonly maximumNoticeLength: number;

  /**
   * The longest command a launch types into its shell, `16384`.
   */
  public static readonly maximumCommandLength: number;

  /**
   * The control characters a command may not hold: C0, DEL and C1, line breaks and tabs among them.
   */
  public static readonly controlCharacters: RegExp;

  /**
   * The control characters commands a run types may not hold: C0, DEL and C1, but the line feed, a carriage return before one, and the tab.
   */
  public static readonly scriptControlCharacters: RegExp;

  /**
   * The characters commands a run types may not hold because they make the commands read differently from what runs: every format
   * or default-ignorable character (Unicode category Cf and property Default_Ignorable_Code_Point), such as the bidirectional marks,
   * embeddings, overrides and isolates, the zero-width characters, the soft hyphen, the byte order mark, the variation selectors, the Hangul
   * fillers and the tag characters. Checked once {@link Resources.scriptEmoji} is taken out.
   */
  public static readonly scriptHiddenCharacters: RegExp;

  /**
   * The emoji, as Unicode's recommended sequences, taken out of a run's commands before {@link Resources.scriptHiddenCharacters} checks them,
   * so the joiners, variation selectors and tags inside an emoji pass.
   */
  public static readonly scriptEmoji: RegExp;

  /**
   * The longest shell name, `200`.
   */
  public static readonly maximumNameLength: number;

  /**
   * The lowest exit code, `-2147483648`.
   */
  public static readonly minimumExitCode: number;

  /**
   * The highest exit code, `4294967295`, so both signed and unsigned 32-bit codes fit.
   */
  public static readonly maximumExitCode: number;

  /**
   * The highest Windows build number, `4294967295`.
   */
  public static readonly maximumBuildNumber: number;

  /**
   * The highest output offset and line number, `Number.MAX_SAFE_INTEGER`.
   */
  public static readonly maximumOffset: number;

  /**
   * The only pseudo-terminal backend a {@link WindowsPty} names on the wire, `"conpty"`.
   */
  public static readonly conptyBackend: string;

  /**
   * The setting that turns command suggestions on and off, `"terminal.suggestions"`, which the runtime and the window both read.
   */
  public static readonly suggestionsSetting: string;

  /**
   * The color that stands for the terminal's default foreground or background, `-1`.
   */
  public static readonly defaultColor: number;

  /**
   * The number of palette colors, `256`, so a palette color is from `0` to `255`.
   */
  public static readonly paletteSize: number;

  /**
   * The offset of an RGB color, `16777216` (`0x1000000`): a run's color `rgbColor + 0xRRGGBB` stands for that RGB color.
   */
  public static readonly rgbColor: number;

  /**
   * The highest color, `33554431` (`0x1ffffff`), the RGB color white.
   */
  public static readonly maximumColor: number;

  /**
   * The highest text style, `511` (`0x1ff`), the sum of every {@link TerminalTextStyle} flag.
   */
  public static readonly maximumTextStyle: number;

  /**
   * The longest stored line, and the longest text run, `1048576`.
   */
  public static readonly maximumLineLength: number;

  /**
   * The most lines one {@link TerminalLinesParams} asks for, `500`.
   */
  public static readonly maximumPageLines: number;

  /**
   * The most lines one {@link TerminalRunOutputParams} asks for, and one {@link TerminalRunOutput} holds, `5000`.
   */
  public static readonly maximumRunLines: number;

  /**
   * The unit of the stored-line limits, one mebibyte: `1048576` bytes.
   */
  public static readonly storedLimitUnit: number;

  /**
   * The stored-line limit a {@link TerminalOpenParams} takes when none is given, 100 mebibytes: `104857600` bytes.
   */
  public static readonly defaultStoredLimit: number;

  /**
   * The lowest stored-line limit, 10 mebibytes: `10485760` bytes.
   */
  public static readonly minimumStoredLimit: number;

  /**
   * The highest stored-line limit, 10,000 mebibytes: `10485760000` bytes.
   */
  public static readonly maximumStoredLimit: number;

  /**
   * The message when a line's runs don't cover its text exactly.
   */
  public static readonly runsMismatch: string;

  /**
   * The message when a line range ends before it starts.
   */
  public static readonly rangeReversed: string;

  /**
   * The message when a line range counts more dropped lines than lie before its start.
   */
  public static readonly droppedBeyondStart: string;

  /**
   * The longest earlier command a terminal suggests, 4,096 UTF-16 code units; the runtime cuts a longer one there.
   */
  public static readonly maximumSuggestionLength: number;

  /**
   * The most earlier commands a terminal keeps for one shell, `200`.
   */
  public static readonly maximumSuggestedCommands: number;

  /**
   * The message when an attachment holds more than {@link Resources.maximumSuggestedCommands} commands.
   */
  public static readonly commandsTooMany: string;

  /**
   * The most command names one {@link TerminalFindCommandsParams} asks about, `64`.
   */
  public static readonly maximumLookedUpCommands: number;

  /**
   * The most choices a {@link TerminalCompletion} holds, `500`.
   */
  public static readonly maximumCompletionItems: number;

  /**
   * The message when a {@link TerminalCompletion} holds more than {@link Resources.maximumCompletionItems} choices.
   */
  public static readonly completionItemsTooMany: string;

  /**
   * The message when a batch's input marks lie outside its output or out of order.
   */
  public static readonly inputOutsideOutput: string;

  /**
   * The message when a page's lines lie outside the stored range it gives.
   */
  public static readonly pageOutsideStored: string;

  /**
   * Gives the JSON path of an object's field.
   *
   * @param path The object's JSON path.
   * @param name The field's name.
   * @returns The field's path, such as `"$.size"`.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatFieldPath(Resources.rootPath, "size"));
   * ```
   */
  public static formatFieldPath(path: string, name: string): string;

  /**
   * Gives the JSON path of an array's item.
   *
   * @param path The array's JSON path.
   * @param index The item's index, from `0`.
   * @returns The item's path, such as `"$.lines[2]"`.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatIndexPath("$.lines", 2));
   * ```
   */
  public static formatIndexPath(path: string, index: number): string;

  /**
   * The {@link ProtocolReader}'s text for a field the message doesn't know, without the path, which {@link JsonException} puts first.
   */
  public static readonly unknownField: string;

  /**
   * The {@link ProtocolReader}'s text for an array item that is empty or only white space, without the path.
   */
  public static readonly blankItem: string;

  /**
   * Gives the {@link ProtocolReader}'s text for a string longer than its limit, without the path.
   *
   * @param maximum The limit, in UTF-16 code units.
   * @returns A sentence that names the limit.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatLongerThan(Resources.maximumTitleLength));
   * ```
   */
  public static formatLongerThan(maximum: number): string;

  /**
   * Gives the {@link ProtocolReader}'s text for a value that isn't a safe integer within its range, without the path.
   *
   * @param minimum The lowest value allowed.
   * @param maximum The highest value allowed.
   * @returns A sentence that names the range.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatOutsideRange(Resources.minimumRows, Resources.maximumRows));
   * ```
   */
  public static formatOutsideRange(minimum: number, maximum: number): string;

  /**
   * Gives the {@link ProtocolReader}'s text for an array with more items than its limit, without the path.
   *
   * @param maximum The most items allowed.
   * @returns A sentence that names the limit.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatMoreItemsThan(Resources.maximumCompletionItems));
   * ```
   */
  public static formatMoreItemsThan(maximum: number): string;

  /**
   * Gives the {@link ProtocolReader}'s text for a value that is none of the values allowed, without the path.
   *
   * @param values The values allowed, in the order the text lists them.
   * @returns A sentence that names the values.
   *
   * @example
   * ```ts
   * import { EndedBy, Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatExpectedOneOf([EndedBy.Exit, EndedBy.Close]));
   * ```
   */
  public static formatExpectedOneOf(values: readonly string[]): string;

  /**
   * Gives the message for a value that isn't a string.
   *
   * @param path The value's JSON path.
   * @returns A sentence that names the path.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatNotString("$.title"));
   * ```
   */
  public static formatNotString(path: string): string;

  /**
   * Gives the message for a string that is empty or only white space.
   *
   * @param path The value's JSON path, or a parameter's name.
   * @returns A sentence that names the path.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatBlankString("sessionId"));
   * ```
   */
  public static formatBlankString(path: string): string;

  /**
   * Gives the message for a string longer than its limit.
   *
   * @param path The value's JSON path, or a parameter's name.
   * @param maximum The limit, in UTF-16 code units.
   * @returns A sentence that names the path and the limit.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatTooLong("title", Resources.maximumTitleLength));
   * ```
   */
  public static formatTooLong(path: string, maximum: number): string;

  /**
   * Says that a value must be an absolute path.
   *
   * @param path The value's JSON path, or a parameter's name.
   * @returns A sentence that names the path.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatNotAbsolutePath("folder"));
   * ```
   */
  public static formatNotAbsolutePath(path: string): string;

  /**
   * Gives the message for a value that isn't a safe integer within its range.
   *
   * @param path The value's JSON path, or a parameter's name.
   * @param minimum The lowest value allowed.
   * @param maximum The highest value allowed.
   * @returns A sentence that names the path and the range.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatNotIntegerInRange("rows", Resources.minimumRows, Resources.maximumRows));
   * ```
   */
  public static formatNotIntegerInRange(path: string, minimum: number, maximum: number): string;

  /**
   * Gives the message for a value that is none of the values allowed.
   *
   * @param path The value's JSON path.
   * @param values The values allowed, in the order the message lists them.
   * @returns A sentence that names the path and the values.
   *
   * @example
   * ```ts
   * import { EndedBy, Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatNotOneOf("$.endedBy", [EndedBy.Exit, EndedBy.Close]));
   * ```
   */
  public static formatNotOneOf(path: string, values: readonly string[]): string;

  /**
   * Gives the message for a value that is no color: neither {@link Resources.defaultColor}, a palette color nor an RGB color.
   *
   * @param name The parameter's name.
   * @returns A sentence that names the parameter and the color ranges.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatNotColor("foreground"));
   * ```
   */
  public static formatNotColor(name: string): string;

  /**
   * Formats the refusal of too many variables.
   *
   * @param path The field's path.
   * @param maximum The most allowed.
   * @returns The message.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatTooManyVariables("environment", Resources.maximumVariables));
   * ```
   */
  public static formatTooManyVariables(path: string, maximum: number): string;

  /**
   * Formats the refusal of variables whose names and values are too long in all.
   *
   * @param path The field's path.
   * @param maximum The most allowed.
   * @returns The message.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatEnvironmentTooLong("environment", Resources.maximumEnvironmentLength));
   * ```
   */
  public static formatEnvironmentTooLong(path: string, maximum: number): string;

  /**
   * Formats the refusal of a name that isn't a portable variable name, which it leaves out.
   *
   * @param path The field's path.
   * @returns The message.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatNotVariableName("environment"));
   * ```
   */
  public static formatNotVariableName(path: string): string;

  /**
   * Formats the refusal of a variable the terminal sets itself.
   *
   * @param path The variable's path, such as `"environment.TERM"`.
   * @returns The message.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatRefusedVariable("environment.TERM"));
   * ```
   */
  public static formatRefusedVariable(path: string): string;

  /**
   * Formats the refusal of two variables whose names differ only in case.
   *
   * @param path The refused variable's path.
   * @param other The path of the variable it matches.
   * @returns The message.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatSameVariable("environment.PATH", "environment.Path"));
   * ```
   */
  public static formatSameVariable(path: string, other: string): string;

  /**
   * Formats the refusal of a string that holds a null character.
   *
   * @param path The field's path.
   * @returns The message.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatNullCharacter("environment.TOKEN"));
   * ```
   */
  public static formatNullCharacter(path: string): string;

  /**
   * Formats the refusal of a command that holds a control character.
   *
   * @param path The field's path.
   * @returns The message.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatControlCharacter("command"));
   * ```
   */
  public static formatControlCharacter(path: string): string;

  /**
   * Formats the refusal of a run's commands that hold a control character other than a line break or a tab.
   *
   * @param path The field's path.
   * @returns The message.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatScriptControlCharacter("command"));
   * ```
   */
  public static formatScriptControlCharacter(path: string): string;

  /**
   * Formats the refusal of a run's commands that hold a format or default-ignorable character, naming its code point.
   *
   * @param path The field's path.
   * @param character The character found.
   * @returns The message.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatScriptHiddenCharacter("command", "\u200b"));
   * ```
   */
  public static formatScriptHiddenCharacter(path: string, character: string): string;

  /**
   * Formats the refusal of a launch answer that gives both a session and a missing folder, or neither.
   *
   * @param path The answer's path.
   * @returns The message.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatNotOneLaunchAnswer(Resources.rootPath));
   * ```
   */
  public static formatNotOneLaunchAnswer(path: string): string;

  /**
   * Formats the refusal of a run answer that gives no session with an outcome other than `NoShell`, or a session with `NoShell`.
   *
   * @param path The answer's path.
   * @returns The message.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatNotOneRunAnswer(Resources.rootPath));
   * ```
   */
  public static formatNotOneRunAnswer(path: string): string;

  /**
   * Formats the refusal of too many lines.
   *
   * @param path The field's path.
   * @param maximum The most allowed.
   * @returns The message.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatTooManyLines("lines", Resources.maximumRunLines));
   * ```
   */
  public static formatTooManyLines(path: string, maximum: number): string;

  /**
   * The message when a list of command names holds more than {@link Resources.maximumLookedUpCommands} names.
   *
   * @param path The field's path, or {@link Resources.valueSubject}.
   * @param maximum The most allowed.
   * @returns The message.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatTooManyNames("names", Resources.maximumLookedUpCommands));
   * ```
   */
  public static formatTooManyNames(path: string, maximum: number): string;

  /**
   * Formats the refusal of a run answer that gives no run ID with the outcome `Typed`, or one with another outcome.
   *
   * @param path The answer's path.
   * @returns The message.
   *
   * @example
   * ```ts
   * import { Resources } from "@noldova/terminal.protocol";
   *
   * console.log(Resources.formatNotOneRunId(Resources.rootPath));
   * ```
   */
  public static formatNotOneRunId(path: string): string;

  /**
   * The name of the `terminal.ack` method.
   */
  public static readonly ackMethod: string;

  /**
   * The name of a message's `asksShell` field.
   */
  public static readonly asksShellField: string;

  /**
   * The name of the `terminal.attach` method.
   */
  public static readonly attachMethod: string;

  /**
   * The name of a message's `backend` field.
   */
  public static readonly backendField: string;

  /**
   * The name of a message's `background` field.
   */
  public static readonly backgroundField: string;

  /**
   * The name of a message's `buildNumber` field.
   */
  public static readonly buildNumberField: string;

  /**
   * The name of the `terminal.close` method.
   */
  public static readonly closeMethod: string;

  /**
   * The name of the `terminal.closeOwner` method.
   */
  public static readonly closeOwnerMethod: string;

  /**
   * The name of the `terminal.closed` event.
   */
  public static readonly closedEvent: string;

  /**
   * The name of a message's `cols` field.
   */
  public static readonly colsField: string;

  /**
   * The name of a message's `column` field.
   */
  public static readonly columnField: string;

  /**
   * The name of a message's `columns` field.
   */
  public static readonly columnsField: string;

  /**
   * The name of the `terminal.commandAdded` event.
   */
  public static readonly commandAddedEvent: string;

  /**
   * The name of a message's `command` field.
   */
  public static readonly commandField: string;

  /**
   * The name of a message's `commands` field.
   */
  public static readonly commandsField: string;

  /**
   * The name of the `terminal.complete` method.
   */
  public static readonly completeMethod: string;

  /**
   * The name of a message's `cursor` field.
   */
  public static readonly cursorField: string;

  /**
   * The name of a message's `cutLines` field.
   */
  public static readonly cutLinesField: string;

  /**
   * The name of the `terminal.cwdChanged` event.
   */
  public static readonly cwdChangedEvent: string;

  /**
   * The name of a message's `cwd` field.
   */
  public static readonly cwdField: string;

  /**
   * The name of a message's `data` field.
   */
  public static readonly dataField: string;

  /**
   * The name of the `terminal.detach` method.
   */
  public static readonly detachMethod: string;

  /**
   * The name of the `terminal.detached` event.
   */
  public static readonly detachedEvent: string;

  /**
   * The name of a message's `dropped` field.
   */
  public static readonly droppedField: string;

  /**
   * The name of a message's `edge` field.
   */
  public static readonly edgeField: string;

  /**
   * The name of a message's `end` field.
   */
  public static readonly endField: string;

  /**
   * The name of a message's `endedBy` field.
   */
  public static readonly endedByField: string;

  /**
   * The name of a message's `endedRuns` field.
   */
  public static readonly endedRunsField: string;

  /**
   * The name of a message's `environment` field.
   */
  public static readonly environmentField: string;

  /**
   * The name of a message's `exitCode` field.
   */
  public static readonly exitCodeField: string;

  /**
   * The name of a message's `exit` field.
   */
  public static readonly exitField: string;

  /**
   * The name of the `terminal.exited` event.
   */
  public static readonly exitedEvent: string;

  /**
   * The name of the `terminal.findCommands` method.
   */
  public static readonly findCommandsMethod: string;

  /**
   * The name of a message's `folder` field.
   */
  public static readonly folderField: string;

  /**
   * The name of a message's `foreground` field.
   */
  public static readonly foregroundField: string;

  /**
   * The name of a message's `id` field.
   */
  public static readonly idField: string;

  /**
   * The name of a message's `input` field.
   */
  public static readonly inputField: string;

  /**
   * The name of the `terminal.input` method.
   */
  public static readonly inputMethod: string;

  /**
   * The name of a message's `inputs` field.
   */
  public static readonly inputsField: string;

  /**
   * The name of a message's `isAgentTerminal` field.
   */
  public static readonly isAgentTerminalField: string;

  /**
   * The name of a message's `isDefault` field.
   */
  public static readonly isDefaultField: string;

  /**
   * The name of a message's `isHidden` field.
   */
  public static readonly isHiddenField: string;

  /**
   * The name of a message's `isPanelTerminal` field.
   */
  public static readonly isPanelTerminalField: string;

  /**
   * The name of a message's `isShellTab` field.
   */
  public static readonly isShellTabField: string;

  /**
   * The name of a message's `items` field.
   */
  public static readonly itemsField: string;

  /**
   * The name of a message's `kind` field.
   */
  public static readonly kindField: string;

  /**
   * The name of a message's `label` field.
   */
  public static readonly labelField: string;

  /**
   * The name of the `terminal.launchCommandEnded` event.
   */
  public static readonly launchCommandEndedEvent: string;

  /**
   * The name of the `terminal.launch` method.
   */
  public static readonly launchMethod: string;

  /**
   * The name of a message's `length` field.
   */
  public static readonly lengthField: string;

  /**
   * The name of a message's `limit` field.
   */
  public static readonly limitField: string;

  /**
   * The name of a message's `line` field.
   */
  public static readonly lineField: string;

  /**
   * The name of a message's `lines` field.
   */
  public static readonly linesField: string;

  /**
   * The name of the `terminal.lines` method.
   */
  public static readonly linesMethod: string;

  /**
   * The name of a message's `maximumLines` field.
   */
  public static readonly maximumLinesField: string;

  /**
   * The name of a message's `missingFolder` field.
   */
  public static readonly missingFolderField: string;

  /**
   * The name of a message's `name` field.
   */
  public static readonly nameField: string;

  /**
   * The name of a message's `names` field.
   */
  public static readonly namesField: string;

  /**
   * The name of a message's `notice` field.
   */
  public static readonly noticeField: string;

  /**
   * The null character, `"\u0000"`, which no text the protocol carries may hold.
   */
  public static readonly nullCharacter: string;

  /**
   * The name of a message's `offset` field.
   */
  public static readonly offsetField: string;

  /**
   * The name of the `terminal.open` method.
   */
  public static readonly openMethod: string;

  /**
   * The name of the `terminal.opened` event.
   */
  public static readonly openedEvent: string;

  /**
   * The name of a message's `opensTab` field.
   */
  public static readonly opensTabField: string;

  /**
   * The name of a message's `outcome` field.
   */
  public static readonly outcomeField: string;

  /**
   * The name of the `terminal.output` event.
   */
  public static readonly outputEvent: string;

  /**
   * The name of a message's `owner` field.
   */
  public static readonly ownerField: string;

  /**
   * The name of a message's `paneId` field.
   */
  public static readonly paneIdField: string;

  /**
   * The refusal of an owner on a panel terminal, `"A panel terminal has no owner."`.
   */
  public static readonly panelTerminalOwned: string;

  /**
   * The name of a message's `pending` field.
   */
  public static readonly pendingField: string;

  /**
   * The name of the `terminal.rename` method.
   */
  public static readonly renameMethod: string;

  /**
   * The name of the `terminal.renamed` event.
   */
  public static readonly renamedEvent: string;

  /**
   * The name of a message's `replaceFrom` field.
   */
  public static readonly replaceFromField: string;

  /**
   * The name of the `terminal.resize` method.
   */
  public static readonly resizeMethod: string;

  /**
   * The name of the `terminal.restart` method.
   */
  public static readonly restartMethod: string;

  /**
   * The name of the `terminal.restarted` event.
   */
  public static readonly restartedEvent: string;

  /**
   * The name of the `terminal.restore` method.
   */
  public static readonly restoreMethod: string;

  /**
   * The name of a message's `rightPrompt` field.
   */
  public static readonly rightPromptField: string;

  /**
   * The name of a message's `rowsAbove` field.
   */
  public static readonly rowsAboveField: string;

  /**
   * The name of a message's `rows` field.
   */
  public static readonly rowsField: string;

  /**
   * The name of the `terminal.runEnded` event.
   */
  public static readonly runEndedEvent: string;

  /**
   * The name of a message's `runId` field.
   */
  public static readonly runIdField: string;

  /**
   * The name of the `terminal.run` method.
   */
  public static readonly runMethod: string;

  /**
   * The name of the `terminal.runOpened` event.
   */
  public static readonly runOpenedEvent: string;

  /**
   * The name of the `terminal.runOutput` method.
   */
  public static readonly runOutputMethod: string;

  /**
   * The name of a message's `runs` field.
   */
  public static readonly runsField: string;

  /**
   * The name of a message's `sessionId` field.
   */
  public static readonly sessionIdField: string;

  /**
   * The name of a message's `sessions` field.
   */
  public static readonly sessionsField: string;

  /**
   * The name of the `terminal.sessions` method.
   */
  public static readonly sessionsMethod: string;

  /**
   * The name of a message's `shellId` field.
   */
  public static readonly shellIdField: string;

  /**
   * The name of a message's `shellKind` field.
   */
  public static readonly shellKindField: string;

  /**
   * The name of a message's `shellKinds` field.
   */
  public static readonly shellKindsField: string;

  /**
   * The name of a message's `shellName` field.
   */
  public static readonly shellNameField: string;

  /**
   * The name of a message's `shells` field.
   */
  public static readonly shellsField: string;

  /**
   * The name of the `terminal.shells` method.
   */
  public static readonly shellsMethod: string;

  /**
   * The name of the `terminal.showOwner` method.
   */
  public static readonly showOwnerMethod: string;

  /**
   * The name of a message's `size` field.
   */
  public static readonly sizeField: string;

  /**
   * The name of a message's `snapshot` field.
   */
  public static readonly snapshotField: string;

  /**
   * The name of a message's `start` field.
   */
  public static readonly startField: string;

  /**
   * The name of a message's `stored` field.
   */
  public static readonly storedField: string;

  /**
   * The name of a message's `storedLimit` field.
   */
  public static readonly storedLimitField: string;

  /**
   * The name of a message's `style` field.
   */
  public static readonly styleField: string;

  /**
   * The name of a message's `text` field.
   */
  public static readonly textField: string;

  /**
   * The name of the `terminal.titleChanged` event.
   */
  public static readonly titleChangedEvent: string;

  /**
   * The name of a message's `title` field.
   */
  public static readonly titleField: string;

  /**
   * The name of the `terminal.visibility` method.
   */
  public static readonly visibilityMethod: string;

  /**
   * The name of a message's `visible` field.
   */
  public static readonly visibleField: string;

  /**
   * The name of a message's `whenBusy` field.
   */
  public static readonly whenBusyField: string;

  /**
   * The name of the `terminal.windowStarted` method.
   */
  public static readonly windowStartedMethod: string;

  /**
   * The name of a message's `windowsPty` field.
   */
  public static readonly windowsPtyField: string;

  /**
   * The name of a message's `wrapped` field.
   */
  public static readonly wrappedField: string;

  /**
   * The message for a run's end at `path` that gives an `exitCode` when `endedBy` isn't `Command`.
   */
  public static formatRunEndWithCode(path: string): string;

  /**
   * The message for a run result at `path` that gives `endedRuns` when its outcome isn't `Typed`.
   */
  public static formatRunEndsUntyped(path: string): string;
}

/**
 * Checks a model's arguments, throwing an {@link ArgumentException} that names the refused one.
 */
export declare class ArgumentValidator {
  /**
   * Checks a session, pane or shell ID.
   *
   * @param name The parameter's name, which the exception carries.
   * @param value The ID: not blank, and at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @throws {@link ArgumentException} Synchronously, when the ID is too long, empty or only white space.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { ArgumentValidator } from "@noldova/terminal.protocol";
   *
   * ArgumentValidator.requireIdentifier("sessionId", "session-1");
   * try {
   *   ArgumentValidator.requireIdentifier("sessionId", " ");
   * }
   * catch (error) {
   *   console.log(error instanceof ArgumentException);
   * }
   * ```
   */
  public static requireIdentifier(name: string, value: string): void;

  /**
   * Checks that a string has text and fits its limit.
   *
   * @param name The parameter's name, which the exception carries.
   * @param value The string: not empty and not only white space.
   * @param maximumLength The limit, in UTF-16 code units.
   * @throws {@link ArgumentException} Synchronously, when the string is longer than the limit, empty or only white space.
   *
   * @example
   * ```ts
   * import { ArgumentValidator, Resources } from "@noldova/terminal.protocol";
   *
   * ArgumentValidator.requireNonBlank("folder", "/home/user", Resources.maximumPathLength);
   * ```
   */
  public static requireNonBlank(name: string, value: string, maximumLength: number): void;

  /**
   * Checks a command typed into a shell as one line, which the terminal enters.
   *
   * @param name The argument's name, for the exception.
   * @param value The command: not blank, at most {@link Resources.maximumCommandLength} UTF-16 code units, with no character that
   * {@link Resources.controlCharacters} matches.
   * @throws {@link ArgumentException} Synchronously, when the command is blank, too long, or holds a control character.
   *
   * @example
   * ```ts
   * import { ArgumentValidator } from "@noldova/terminal.protocol";
   *
   * ArgumentValidator.requireCommand("command", "npm install");
   * ```
   */
  public static requireCommand(name: string, value: string): void;

  /**
   * Checks the command names typed at a shell's prompt that a terminal asks about.
   *
   * @param name The argument's name, for the exception.
   * @param value The names: at most {@link Resources.maximumLookedUpCommands}, each not blank and at most
   * {@link Resources.maximumSuggestionLength} UTF-16 code units.
   * @throws {@link ArgumentException} Synchronously, when there are too many names, or one is blank or too long.
   *
   * @example
   * ```ts
   * import { ArgumentValidator } from "@noldova/terminal.protocol";
   *
   * ArgumentValidator.requireCommandNames("names", ["git", "npm"]);
   * ```
   */
  public static requireCommandNames(name: string, value: readonly string[]): void;

  /**
   * Checks the commands a run types into a shell as a paste types them, such as a code block's: one line or several.
   *
   * @param name The argument's name, for the exception.
   * @param value The commands: not blank, at most {@link Resources.maximumCommandLength} UTF-16 code units, with no character that
   * {@link Resources.scriptControlCharacters} matches, so lines end with a line feed or a carriage return and line feed, and may hold tabs,
   * and, outside emoji, none that {@link Resources.scriptHiddenCharacters} matches.
   * @throws {@link ArgumentException} Synchronously, when the commands are blank, too long, or hold another control character, or a
   * format or default-ignorable character outside an emoji, which the message names by its code point.
   *
   * @example
   * ```ts
   * import { ArgumentValidator } from "@noldova/terminal.protocol";
   *
   * ArgumentValidator.requireScript("command", "npm install\nnpm test");
   * ```
   */
  public static requireScript(name: string, value: string): void;

  /**
   * Checks that a string is an absolute folder path that fits {@link Resources.maximumPathLength}: one from the root on Unix, a Windows drive
   * or a Windows share, as {@link Resources.absolutePathPattern} matches.
   *
   * @param name The parameter's name, which the exception carries.
   * @param value The path.
   * @throws {@link ArgumentException} Synchronously, when the path is blank, too long or relative.
   *
   * @example
   * ```ts
   * import { ArgumentValidator } from "@noldova/terminal.protocol";
   *
   * ArgumentValidator.requireAbsolutePath("folder", "C:\\Users\\user");
   * ```
   */
  public static requireAbsolutePath(name: string, value: string): void;

  /**
   * Checks that a string fits its limit; an empty string fits.
   *
   * @param name The parameter's name, which the exception carries.
   * @param value The string.
   * @param maximumLength The limit, in UTF-16 code units.
   * @throws {@link ArgumentException} Synchronously, when the string is longer than the limit.
   *
   * @example
   * ```ts
   * import { ArgumentValidator, Resources } from "@noldova/terminal.protocol";
   *
   * ArgumentValidator.requireMaximumLength("title", "", Resources.maximumTitleLength);
   * ```
   */
  public static requireMaximumLength(name: string, value: string, maximumLength: number): void;

  /**
   * Checks that a number is a safe integer within a range.
   *
   * @param name The parameter's name, which the exception carries.
   * @param value The number.
   * @param minimum The lowest value allowed.
   * @param maximum The highest value allowed.
   * @throws {@link ArgumentOutOfRangeException} Synchronously, when the number isn't a safe integer or lies outside the range.
   *
   * @example
   * ```ts
   * import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
   * import { ArgumentValidator, Resources } from "@noldova/terminal.protocol";
   *
   * ArgumentValidator.requireIntegerInRange("rows", 24, Resources.minimumRows, Resources.maximumRows);
   * try {
   *   ArgumentValidator.requireIntegerInRange("rows", 2.5, Resources.minimumRows, Resources.maximumRows);
   * }
   * catch (error) {
   *   console.log(error instanceof ArgumentOutOfRangeException);
   * }
   * ```
   */
  public static requireIntegerInRange(name: string, value: number, minimum: number, maximum: number): void;

  /**
   * Checks variables for a shell's environment: at most {@link Resources.maximumVariables}, each with a portable name of at most
   * {@link Resources.maximumVariableNameLength} UTF-16 code units, none of {@link Resources.refusedVariables} nor starting with
   * {@link Resources.refusedVariablePrefix}, in any case, no two whose names differ only in case, and each value a string of at most
   * {@link Resources.maximumVariableValueLength} UTF-16 code units without a null character, the names and values holding at most
   * {@link Resources.maximumEnvironmentLength} in all.
   *
   * @param name The parameter's name, which the exception carries, followed by the variable's name, such as `"environment.TERM"`, when one
   * variable is refused; a refusal never carries a value.
   * @param value The variables, by name.
   * @throws {@link ArgumentException} Synchronously, when the variables break a rule above.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { ArgumentValidator } from "@noldova/terminal.protocol";
   *
   * ArgumentValidator.requireEnvironment("environment", { API_URL: "https://example.com" });
   * try {
   *   ArgumentValidator.requireEnvironment("environment", { TERM: "dumb" });
   * }
   * catch (error) {
   *   console.log(error instanceof ArgumentException && error.parameterName);
   * }
   * ```
   */
  public static requireEnvironment(name: string, value: Readonly<Record<string, string>>): void;

  /**
   * Checks that a value is one of the values allowed.
   *
   * @param name The parameter's name, which the exception carries.
   * @param value The value.
   * @param values The values allowed, in the order the message lists them.
   * @throws {@link ArgumentException} Synchronously, when the value is none of them.
   *
   * @example
   * ```ts
   * import { ArgumentValidator, TerminalRunBusy } from "@noldova/terminal.protocol";
   *
   * ArgumentValidator.requireOneOf("whenBusy", TerminalRunBusy.Refuse, Object.values(TerminalRunBusy));
   * ```
   */
  public static requireOneOf(name: string, value: string, values: readonly string[]): void;

  /**
   * Checks that each item of a list is one of the values allowed.
   *
   * @param name The parameter's name; the exception carries it with the first refused item's index, such as `"shellKinds.1"`.
   * @param value The items.
   * @param values The values allowed, in the order the message lists them.
   * @throws {@link ArgumentException} Synchronously, when an item is none of them.
   *
   * @example
   * ```ts
   * import { ArgumentValidator, TerminalShellKind } from "@noldova/terminal.protocol";
   *
   * ArgumentValidator.requireEachOneOf("shellKinds", [TerminalShellKind.Bash], Object.values(TerminalShellKind));
   * ```
   */
  public static requireEachOneOf(name: string, value: readonly string[], values: readonly string[]): void;

  /**
   * Throws the problem a `find…Problem` method returned, as the matching `require…` method would.
   *
   * @param problem The problem, or `null` when there is none.
   * @throws {@link ArgumentException} Synchronously, with the problem's message and its parameter name, when there is one.
   *
   * @example
   * ```ts
   * import { ArgumentValidator } from "@noldova/terminal.protocol";
   *
   * ArgumentValidator.throwIfProblem(ArgumentValidator.findIdentifierProblem("sessionId", "session-1"));
   * ```
   */
  public static throwIfProblem(problem: ArgumentProblem | null): void;

  /**
   * Finds what {@link ArgumentValidator.requireIdentifier} would refuse, without throwing.
   *
   * @param name The parameter's name.
   * @param value The ID.
   * @returns The problem, or `null` when the ID is accepted.
   *
   * @example
   * ```ts
   * import { ArgumentValidator } from "@noldova/terminal.protocol";
   *
   * console.log(ArgumentValidator.findIdentifierProblem("sessionId", " ")?.reason);
   * ```
   */
  public static findIdentifierProblem(name: string, value: string): ArgumentProblem | null;

  /**
   * Finds what {@link ArgumentValidator.requireNonBlank} would refuse, without throwing.
   *
   * @param name The parameter's name.
   * @param value The string.
   * @param maximumLength The limit, in UTF-16 code units.
   * @returns The problem, or `null` when the string is accepted.
   *
   * @example
   * ```ts
   * import { ArgumentValidator, Resources } from "@noldova/terminal.protocol";
   *
   * console.log(ArgumentValidator.findNonBlankProblem("notice", "", Resources.maximumNoticeLength)?.reason);
   * ```
   */
  public static findNonBlankProblem(name: string, value: string, maximumLength: number): ArgumentProblem | null;

  /**
   * Finds what {@link ArgumentValidator.requireCommand} would refuse, without throwing.
   *
   * @param name The argument's name.
   * @param value The command.
   * @returns The problem, or `null` when the command is accepted.
   *
   * @example
   * ```ts
   * import { ArgumentValidator } from "@noldova/terminal.protocol";
   *
   * console.log(ArgumentValidator.findCommandProblem("command", "npm install\n")?.reason);
   * ```
   */
  public static findCommandProblem(name: string, value: string): ArgumentProblem | null;

  /**
   * Finds what {@link ArgumentValidator.requireCommandNames} would refuse, without throwing.
   *
   * @param name The argument's name.
   * @param value The names.
   * @returns The problem, or `null` when the names are accepted.
   *
   * @example
   * ```ts
   * import { ArgumentValidator } from "@noldova/terminal.protocol";
   *
   * console.log(ArgumentValidator.findCommandNamesProblem("names", ["git", " "])?.reason);
   * ```
   */
  public static findCommandNamesProblem(name: string, value: readonly string[]): ArgumentProblem | null;

  /**
   * Finds what {@link ArgumentValidator.requireScript} would refuse, without throwing.
   *
   * @param name The argument's name.
   * @param value The commands.
   * @returns The problem, or `null` when the commands are accepted.
   *
   * @example
   * ```ts
   * import { ArgumentValidator } from "@noldova/terminal.protocol";
   *
   * console.log(ArgumentValidator.findScriptProblem("command", "npm test")?.reason);
   * ```
   */
  public static findScriptProblem(name: string, value: string): ArgumentProblem | null;

  /**
   * Finds what {@link ArgumentValidator.requireAbsolutePath} would refuse, without throwing.
   *
   * @param name The parameter's name.
   * @param value The path.
   * @returns The problem, or `null` when the path is accepted.
   *
   * @example
   * ```ts
   * import { ArgumentValidator } from "@noldova/terminal.protocol";
   *
   * console.log(ArgumentValidator.findAbsolutePathProblem("folder", "work")?.reason);
   * ```
   */
  public static findAbsolutePathProblem(name: string, value: string): ArgumentProblem | null;

  /**
   * Finds what {@link ArgumentValidator.requireMaximumLength} would refuse, without throwing.
   *
   * @param name The parameter's name.
   * @param value The string.
   * @param maximumLength The limit, in UTF-16 code units.
   * @returns The problem, or `null` when the string fits.
   *
   * @example
   * ```ts
   * import { ArgumentValidator, Resources } from "@noldova/terminal.protocol";
   *
   * console.log(ArgumentValidator.findMaximumLengthProblem("title", "Build", Resources.maximumTitleLength));
   * ```
   */
  public static findMaximumLengthProblem(name: string, value: string, maximumLength: number): ArgumentProblem | null;

  /**
   * Finds what {@link ArgumentValidator.requireIntegerInRange} would refuse, without throwing.
   *
   * @param name The parameter's name.
   * @param value The number.
   * @param minimum The lowest value allowed.
   * @param maximum The highest value allowed.
   * @returns The problem, or `null` when the number is accepted.
   *
   * @example
   * ```ts
   * import { ArgumentValidator, Resources } from "@noldova/terminal.protocol";
   *
   * console.log(ArgumentValidator.findIntegerInRangeProblem("rows", 0, Resources.minimumRows, Resources.maximumRows)?.reason);
   * ```
   */
  public static findIntegerInRangeProblem(name: string, value: number, minimum: number, maximum: number): ArgumentProblem | null;

  /**
   * Finds what {@link ArgumentValidator.requireEnvironment} would refuse, without throwing.
   *
   * @param name The parameter's name; the problem names one variable as `"environment.TERM"` when only that variable is refused.
   * @param value The variables, by name.
   * @returns The problem, which never holds a value, or `null` when the variables are accepted.
   *
   * @example
   * ```ts
   * import { ArgumentValidator } from "@noldova/terminal.protocol";
   *
   * console.log(ArgumentValidator.findEnvironmentProblem("environment", { TERM: "dumb" })?.parameterName);
   * ```
   */
  public static findEnvironmentProblem(name: string, value: Readonly<Record<string, string>>): ArgumentProblem | null;

  /**
   * Finds what {@link ArgumentValidator.requireOneOf} would refuse, without throwing.
   *
   * @param name The parameter's name.
   * @param value The value.
   * @param values The values allowed.
   * @returns The problem, or `null` when the value is one of them.
   *
   * @example
   * ```ts
   * import { ArgumentValidator, TerminalRunBusy } from "@noldova/terminal.protocol";
   *
   * console.log(ArgumentValidator.findOneOfProblem("whenBusy", "Wait", Object.values(TerminalRunBusy))?.reason);
   * ```
   */
  public static findOneOfProblem(name: string, value: string, values: readonly string[]): ArgumentProblem | null;

  /**
   * Finds what {@link ArgumentValidator.requireEachOneOf} would refuse, without throwing.
   *
   * @param name The parameter's name.
   * @param value The items.
   * @param values The values allowed.
   * @returns The first refused item's problem, named with its index, or `null` when every item is one of them.
   *
   * @example
   * ```ts
   * import { ArgumentValidator, TerminalShellKind } from "@noldova/terminal.protocol";
   *
   * console.log(ArgumentValidator.findEachOneOfProblem("shellKinds", ["Bash", "Csh"], Object.values(TerminalShellKind))?.parameterName);
   * ```
   */
  public static findEachOneOfProblem(name: string, value: readonly string[], values: readonly string[]): ArgumentProblem | null;
}

/**
 * What an {@link ArgumentValidator} check refused: the parameter, the reason a person reads, which names it, and the message an exception
 * carries, which doesn't, since context's `ArgumentException` adds the name.
 * A `find…Problem` method returns one, so a caller can build its own message; the matching `require…` method throws it.
 *
 * @example
 * ```ts
 * import { ArgumentValidator, type ArgumentProblem } from "@noldova/terminal.protocol";
 *
 * const problem: ArgumentProblem | null = ArgumentValidator.findAbsolutePathProblem("folder", "work");
 * console.log(problem?.parameterName, problem?.reason);
 * ```
 */
export declare class ArgumentProblem {
  /**
   * The refused parameter's name, such as `"folder"`, `"environment.TERM"` or `"shellKinds.1"`.
   */
  public readonly parameterName: string;

  /**
   * Why it was refused, a sentence that starts with the parameter's name, such as `"folder must be an absolute path."`.
   */
  public readonly reason: string;

  /**
   * Why it was refused, a sentence that starts with {@link Resources.valueSubject}, such as `"The value must be an absolute path."`.
   */
  public readonly message: string;

  /**
   * Makes a problem.
   *
   * @param parameterName The refused parameter's name.
   * @param reason Why it was refused, naming the parameter.
   * @param message Why it was refused, starting with {@link Resources.valueSubject}.
   *
   * @example
   * ```ts
   * import { ArgumentProblem } from "@noldova/terminal.protocol";
   *
   * console.log(new ArgumentProblem("folder", "folder must be an absolute path.", "The value must be an absolute path.").message);
   * ```
   */
  public constructor(parameterName: string, reason: string, message: string);
}

/**
 * Reads the fields of one untrusted JSON object, throwing a {@link JsonException} that names the refused field's path.
 *
 * @remarks
 * It reads through context's `JsonReader` from `@noldova/context.json`, which first narrows the value to JSON, and adds the protocol's
 * limits: each read takes the longest string, the range of a number or the most items allowed, and {@link ProtocolReader.allowOnly} refuses
 * unknown fields.
 * A reader holds the object's fields as they were when it was made.
 * A required field must be present; a nullable one may hold `null`; an optional one may be absent.
 *
 * @example
 * ```ts
 * import { ProtocolReader, Resources } from "@noldova/terminal.protocol";
 *
 * const reader = ProtocolReader.fromValue({ sessionId: "session-1", start: 0 });
 * reader.allowOnly(["sessionId", "start"]);
 * console.log(reader.readNonBlankString("sessionId", Resources.maximumIdentifierLength), reader.readInteger("start", 0, Resources.maximumOffset));
 * ```
 */
export declare class ProtocolReader {
  /**
   * The object's JSON path, from {@link Resources.rootPath}, which the paths of its fields extend.
   */
  public get path(): string;

  private constructor();

  /**
   * Makes a reader of a JSON object.
   *
   * @param value The value, untrusted: a JSON object, not `null` and not an array, holding only what JSON can carry.
   * @param path The value's JSON path; {@link Resources.rootPath} when left out.
   * @returns A new reader of the object's own fields; a member whose value is `undefined` stays a field, which every read refuses and
   * {@link ProtocolReader.allowOnly} checks.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, is `null` or is an array; or, from context's `JsonReader`,
   * when it holds a value JSON can't carry, such as a function, a non-finite number or an object that isn't plain, or nests deeper than
   * its maximum depth.
   *
   * @example
   * ```ts
   * import { JsonException } from "@noldova/context.json";
   * import { ProtocolReader } from "@noldova/terminal.protocol";
   *
   * const reader = ProtocolReader.fromValue({ cols: 80, rows: 24 });
   * try {
   *   ProtocolReader.fromValue([], "$.size");
   * }
   * catch (error) {
   *   console.log(reader.path, error instanceof JsonException);
   * }
   * ```
   */
  public static fromValue(value: unknown, path?: string): ProtocolReader;

  /**
   * Makes a model from the fields read, so that a rule only its constructor checks refuses the untrusted value as a reading error.
   *
   * @remarks
   * A model's `fromJson` and `fromReader` read their fields inside the factory, so the reading errors of nested objects pass through with
   * their own paths.
   *
   * @param factory Reads the fields and calls the model's constructor.
   * @returns What the factory returns.
   * @throws {@link JsonException} Synchronously, when the factory throws an {@link ArgumentException}: at the path of the field the
   * exception names, under the reader's path, or at the reader's path when it names none, with the exception's message and the exception
   * as its cause.
   * @throws Synchronously, any other error the factory throws, unchanged.
   *
   * @example
   * ```ts
   * import { JsonException } from "@noldova/context.json";
   * import { ProtocolReader, Resources, TerminalLaunched } from "@noldova/terminal.protocol";
   *
   * const reader = ProtocolReader.fromValue({ sessionId: null, missingFolder: "gone" });
   * try {
   *   reader.create(() => new TerminalLaunched(reader.readNullableNonBlankString("sessionId", Resources.maximumIdentifierLength),
   *     reader.readNullableNonBlankString("missingFolder", Resources.maximumPathLength)));
   * }
   * catch (error) {
   *   console.log(error instanceof JsonException && error.path);
   * }
   * ```
   */
  public create<T>(factory: () => T): T;

  /**
   * Checks that the object has no field but the given ones.
   *
   * @param names The fields the object may have; none of them need be present.
   * @throws {@link JsonException} Synchronously, at the first field not among the names.
   *
   * @example
   * ```ts
   * import { ProtocolReader } from "@noldova/terminal.protocol";
   *
   * ProtocolReader.fromValue({ sessionId: "session-1" }).allowOnly(["sessionId", "paneId"]);
   * ```
   */
  public allowOnly(names: readonly string[]): void;

  /**
   * Reads a required string field; an empty string is allowed.
   *
   * @param name The field's name.
   * @param maximumLength The longest string allowed, in UTF-16 code units.
   * @returns The field's string.
   * @throws {@link JsonException} Synchronously, when the field is missing, isn't a string or is longer than the limit.
   *
   * @example
   * ```ts
   * import { ProtocolReader, Resources } from "@noldova/terminal.protocol";
   *
   * console.log(ProtocolReader.fromValue({ title: "" }).readString("title", Resources.maximumTitleLength));
   * ```
   */
  public readString(name: string, maximumLength: number): string;

  /**
   * Reads a required string field that has text.
   *
   * @param name The field's name.
   * @param maximumLength The longest string allowed, in UTF-16 code units.
   * @returns The field's string, which isn't empty or only white space.
   * @throws {@link JsonException} Synchronously, when the field is missing, isn't a string, is longer than the limit, or is empty or only white space.
   *
   * @example
   * ```ts
   * import { ProtocolReader, Resources } from "@noldova/terminal.protocol";
   *
   * console.log(ProtocolReader.fromValue({ cwd: "/tmp" }).readNonBlankString("cwd", Resources.maximumPathLength));
   * ```
   */
  public readNonBlankString(name: string, maximumLength: number): string;

  /**
   * Reads a required field that is `null` or a string that has text.
   *
   * @param name The field's name.
   * @param maximumLength The longest string allowed, in UTF-16 code units.
   * @returns The field's string, or `null` when the field holds `null`.
   * @throws {@link JsonException} Synchronously, when the field is missing, or isn't `null` and isn't a string that has text within the limit.
   *
   * @example
   * ```ts
   * import { ProtocolReader, Resources } from "@noldova/terminal.protocol";
   *
   * console.log(ProtocolReader.fromValue({ folder: null }).readNullableNonBlankString("folder", Resources.maximumPathLength));
   * ```
   */
  public readNullableNonBlankString(name: string, maximumLength: number): string | null;

  /**
   * Reads a required boolean field.
   *
   * @param name The field's name.
   * @returns The field's value.
   * @throws {@link JsonException} Synchronously, when the field is missing or isn't `true` or `false`.
   *
   * @example
   * ```ts
   * import { ProtocolReader } from "@noldova/terminal.protocol";
   *
   * console.log(ProtocolReader.fromValue({ visible: true }).readBoolean("visible"));
   * ```
   */
  public readBoolean(name: string): boolean;

  /**
   * Reads a required integer field within a range.
   *
   * @param name The field's name.
   * @param minimum The lowest value allowed.
   * @param maximum The highest value allowed.
   * @returns The field's value.
   * @throws {@link JsonException} Synchronously, when the field is missing, isn't a safe integer or lies outside the range.
   *
   * @example
   * ```ts
   * import { ProtocolReader, Resources } from "@noldova/terminal.protocol";
   *
   * console.log(ProtocolReader.fromValue({ rows: 24 }).readInteger("rows", Resources.minimumRows, Resources.maximumRows));
   * ```
   */
  public readInteger(name: string, minimum: number, maximum: number): number;

  /**
   * Reads a required field that is `null` or an integer within a range.
   *
   * @param name The field's name.
   * @param minimum The lowest value allowed.
   * @param maximum The highest value allowed.
   * @returns The field's value, or `null` when the field holds `null`.
   * @throws {@link JsonException} Synchronously, when the field is missing, or isn't `null` and isn't a safe integer within the range.
   *
   * @example
   * ```ts
   * import { ProtocolReader, Resources } from "@noldova/terminal.protocol";
   *
   * console.log(ProtocolReader.fromValue({ exitCode: null }).readNullableInteger("exitCode", Resources.minimumExitCode, Resources.maximumExitCode));
   * ```
   */
  public readNullableInteger(name: string, minimum: number, maximum: number): number | null;

  /**
   * Reads a string field that may be absent; an empty string is allowed.
   *
   * @param name The field's name.
   * @param maximumLength The longest string allowed, in UTF-16 code units.
   * @returns The field's string, or `undefined` when the field is absent.
   * @throws {@link JsonException} Synchronously, when the field is present and isn't a string, holds `null`, or is longer than the limit.
   *
   * @example
   * ```ts
   * import { ProtocolReader, Resources } from "@noldova/terminal.protocol";
   *
   * console.log(ProtocolReader.fromValue({}).readOptionalString("title", Resources.maximumTitleLength));
   * ```
   */
  public readOptionalString(name: string, maximumLength: number): string | undefined;

  /**
   * Reads a string field that may be absent or `null`, either of which reads as `null`; an empty string is allowed.
   *
   * @param name The field's name.
   * @param maximumLength The longest string allowed, in UTF-16 code units.
   * @returns The field's string, or `null` when the field is absent or holds `null`.
   * @throws {@link JsonException} Synchronously, when the field holds something other than a string or `null`, or is longer than the limit.
   *
   * @example
   * ```ts
   * import { ProtocolReader, Resources } from "@noldova/terminal.protocol";
   *
   * console.log(ProtocolReader.fromValue({ folder: null }).readOptionalNullableString("folder", Resources.maximumPathLength));
   * ```
   */
  public readOptionalNullableString(name: string, maximumLength: number): string | null;

  /**
   * Reads an integer field within a range that may be absent.
   *
   * @param name The field's name.
   * @param minimum The lowest value allowed.
   * @param maximum The highest value allowed.
   * @returns The field's value, or `undefined` when the field is absent.
   * @throws {@link JsonException} Synchronously, when the field is present and isn't a safe integer within the range, or holds `null`.
   *
   * @example
   * ```ts
   * import { ProtocolReader, Resources } from "@noldova/terminal.protocol";
   *
   * console.log(ProtocolReader.fromValue({ limit: 100 }).readOptionalInteger("limit", 1, Resources.maximumPageLines));
   * ```
   */
  public readOptionalInteger(name: string, minimum: number, maximum: number): number | undefined;

  /**
   * Reads a boolean field that may be absent.
   *
   * @param name The field's name.
   * @returns The field's value, or `undefined` when the field is absent.
   * @throws {@link JsonException} Synchronously, when the field is present and isn't a boolean, or holds `null`.
   *
   * @example
   * ```ts
   * import { ProtocolReader } from "@noldova/terminal.protocol";
   *
   * console.log(ProtocolReader.fromValue({}).readOptionalBoolean("isPanelTerminal"));
   * ```
   */
  public readOptionalBoolean(name: string): boolean | undefined;

  /**
   * Reads a required field that holds one of the given strings.
   *
   * @typeParam T The strings allowed, as a union of literal types.
   * @param name The field's name.
   * @param values The strings allowed, compared exactly.
   * @returns The matching item of the values.
   * @throws {@link JsonException} Synchronously, when the field is missing or holds none of the values.
   *
   * @example
   * ```ts
   * import { EndedBy, ProtocolReader } from "@noldova/terminal.protocol";
   *
   * const endedBy: EndedBy = ProtocolReader.fromValue({ endedBy: "Close" }).readOneOf("endedBy", [EndedBy.Exit, EndedBy.Close]);
   * console.log(endedBy);
   * ```
   */
  public readOneOf<T extends string>(name: string, values: readonly T[]): T;

  /**
   * Reads a required array field whose every item is one of the given strings.
   *
   * @typeParam T The strings allowed, as a union of literal types.
   * @param name The field's name.
   * @param values The strings allowed, compared exactly.
   * @returns A new array of the matching items, in order.
   * @throws {@link JsonException} Synchronously, when the field is missing or isn't an array, or an item, which the path names by its
   * index, holds none of the values.
   *
   * @example
   * ```ts
   * import { ProtocolReader, TerminalShellKind } from "@noldova/terminal.protocol";
   *
   * console.log(ProtocolReader.fromValue({ shellKinds: ["Bash", "Zsh"] }).readOneOfArray("shellKinds", Object.values(TerminalShellKind)));
   * ```
   */
  public readOneOfArray<T extends string>(name: string, values: readonly T[]): readonly T[];

  /**
   * Reads an optional array field whose every item is one of the given strings, as {@link ProtocolReader.readOneOfArray} does.
   *
   * @typeParam T The strings allowed, as a union of literal types.
   * @param name The field's name.
   * @param values The strings allowed, compared exactly.
   * @returns A new array of the matching items, in order, or an empty one when the field is absent.
   * @throws {@link JsonException} Synchronously, when the field isn't an array, or an item, which the path names by its index, holds none of
   * the values.
   *
   * @example
   * ```ts
   * import { ProtocolReader, TerminalShellKind } from "@noldova/terminal.protocol";
   *
   * console.log(ProtocolReader.fromValue({}).readOptionalOneOfArray("shellKinds", Object.values(TerminalShellKind)).length);
   * ```
   */
  public readOptionalOneOfArray<T extends string>(name: string, values: readonly T[]): readonly T[];

  /**
   * Reads a required object field.
   *
   * @param name The field's name.
   * @returns A new reader of the field's object, whose path is the field's.
   * @throws {@link JsonException} Synchronously, when the field is missing or isn't a JSON object.
   *
   * @example
   * ```ts
   * import { ProtocolReader } from "@noldova/terminal.protocol";
   *
   * console.log(ProtocolReader.fromValue({ size: { cols: 80, rows: 24 } }).readObject("size").path);
   * ```
   */
  public readObject(name: string): ProtocolReader;

  /**
   * Reads a required field that is `null` or an object.
   *
   * @param name The field's name.
   * @returns A new reader of the field's object, or `null` when the field holds `null`.
   * @throws {@link JsonException} Synchronously, when the field is missing, or isn't `null` and isn't a JSON object.
   *
   * @example
   * ```ts
   * import { ProtocolReader } from "@noldova/terminal.protocol";
   *
   * console.log(ProtocolReader.fromValue({ exit: null }).readNullableObject("exit"));
   * ```
   */
  public readNullableObject(name: string): ProtocolReader | null;

  /**
   * Reads a required field that is an object whose every field is a string.
   *
   * @param name The field's name.
   * @param maximumLength The longest string, in UTF-16 code units.
   * @returns A new object of the strings, by their fields' names.
   * @throws {@link JsonException} Synchronously, when the field is missing or isn't a JSON object, or one of its fields isn't a string or is
   * too long; the path names that field, never its value.
   *
   * @example
   * ```ts
   * import { ProtocolReader, Resources } from "@noldova/terminal.protocol";
   *
   * console.log(ProtocolReader.fromValue({ environment: { API_URL: "https://example.com" } }).readStringRecord("environment", Resources.maximumVariableValueLength));
   * ```
   */
  public readStringRecord(name: string, maximumLength: number): Readonly<Record<string, string>>;

  /**
   * Reads a required field that is an array of objects.
   *
   * @param name The field's name.
   * @returns A new reader of each item, in the array's order, with paths such as `"$.lines.2"`; empty for an empty array.
   * @throws {@link JsonException} Synchronously, when the field is missing, isn't a JSON array, or has an item that isn't a JSON object.
   *
   * @example
   * ```ts
   * import { ProtocolReader } from "@noldova/terminal.protocol";
   *
   * const items = ProtocolReader.fromValue({ shells: [{ id: "bash" }] }).readObjectArray("shells");
   * console.log(items.length, items[0]?.path);
   * ```
   */
  public readObjectArray(name: string): readonly ProtocolReader[];

  /**
   * Reads a required field that is an array of strings, none blank.
   *
   * @param name The field's name.
   * @param maximumLength The most UTF-16 code units an item may have.
   * @param maximumCount The most items the array may have.
   * @returns The items, in the array's order; empty for an empty array.
   * @throws {@link JsonException} Synchronously, when the field is missing, isn't a JSON array, has more items than allowed, or has an
   * item that isn't a string, is blank or is too long; the exception's path names the field or the item, such as `"$.commands.2"`.
   *
   * @example
   * ```ts
   * import { ProtocolReader } from "@noldova/terminal.protocol";
   *
   * console.log(ProtocolReader.fromValue({ commands: ["npm test"] }).readNonBlankStringArray("commands", 4096, 200));
   * ```
   */
  public readNonBlankStringArray(name: string, maximumLength: number, maximumCount: number): readonly string[];
}

/**
 * The shared symbol {@link RuntimeTerminalOwners}'s brand is kept under.
 */
declare const runtimeOwnersBrand: unique symbol;

/**
 * The runtime service `terminal.owners`, which closes the terminals an app tied to an owner, such as a chat, and ties an app's agent sessions
 * to an owner, for the modules that declare `terminal` as a dependency.
 *
 * @remarks
 * Terminal's runtime part publishes an instance of it. A module's runtime part reads it with `getService("terminal.owners", RuntimeTerminalOwners)`,
 * which checks the service against this class, so the module takes this package, which has no dependencies, and not Terminal's window
 * package. The check holds while the module and Terminal load one copy of this package, at the same version, as a shared install does; with
 * two copies, it throws a {@link PackageCopiesException} that says so, at the module's first `getService`.
 *
 * @example
 * ```ts
 * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
 * import { RuntimeTerminalOwners } from "@noldova/terminal.protocol";
 *
 * export async function closeChatTerminalsAsync(context: IRuntimePartContext, chatId: string): Promise<void> {
 *   await context.getService("terminal.owners", RuntimeTerminalOwners).closeAsync(`example.chat/${chatId}`);
 * }
 * ```
 */
export declare abstract class RuntimeTerminalOwners {
  /**
   * The brand, under the shared symbol {@link Resources.runtimeOwnersBrand}, that lets a check against the class tell a service of another
   * installed copy of the package from an object of another kind. It is on the prototype, so a copy of an instance's fields doesn't carry it.
   */
  public get [runtimeOwnersBrand](): true;

  /**
   * Answers `instanceof`, and so `getService`'s check: true for an instance of the class, or of the subclass it is called on, and false
   * for an object of another kind, such as an instance of another subclass from the same copy of the package.
   *
   * @param value The value checked.
   * @returns Whether the value is an instance of the class.
   * @throws {@link PackageCopiesException} Synchronously, when another installed copy of the package made the value, with
   * {@link Resources.runtimeOwnersCopies} as its message.
   *
   * @example
   * ```ts
   * import { RuntimeTerminalOwners } from "@noldova/terminal.protocol";
   *
   * console.log({} instanceof RuntimeTerminalOwners);
   * ```
   */
  public static [Symbol.hasInstance](value: unknown): boolean;

  /**
   * Ends the shell of every terminal tied to the owner and forgets them, as closing their tabs does, and every window closes their tabs.
   * The terminals kept for the next run go too, and the agent sessions bound to the owner with
   * {@link RuntimeTerminalOwners.bindAgentSession} are unbound at once; a session's `terminal.owner` binding stays until the session ends, so
   * the app ends the owner's agent sessions before it closes the owner.
   *
   * @param owner The owner: not blank, at most {@link Resources.maximumOwnerLength} UTF-16 code units.
   * @returns A promise that resolves once every shell has ended or its grace has run out; with no terminal of the owner, at once.
   * It rejects with an {@link ArgumentException} when the owner is blank or too long, and once Terminal's runtime part has deactivated.
   *
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   * import { RuntimeTerminalOwners } from "@noldova/terminal.protocol";
   *
   * export async function closeChatTerminalsAsync(context: IRuntimePartContext, chatId: string): Promise<void> {
   *   await context.getService("terminal.owners", RuntimeTerminalOwners).closeAsync(`example.chat/${chatId}`);
   * }
   * ```
   */
  public abstract closeAsync(owner: string): Promise<void>;

  /**
   * Ties an agent session to an owner, such as the chat whose agent it runs, as the session's `terminal.owner` binding does. The terminals
   * the session's `terminal_open` opens from then on take that owner: every window shows them while it shows the owner, and the person types
   * into them, interrupts them and closes them, as with the owner's other terminals. They stay open when the session ends, until the person
   * closes them or the owner closes. The session also reaches every agent's terminal of that owner, whichever of the owner's sessions opened
   * it, one running at the same time included, but not the person's own, unless they were shared with it.
   *
   * @remarks
   * A session bound here takes this owner over its `terminal.owner` binding, and a session bound again takes the new owner for what it opens
   * and reaches from then on; the terminals it opened keep theirs. The binding made here goes when the session ends or its owner closes; bind
   * before the session's first call, since a binding made after the session ended stays until {@link RuntimeTerminalOwners.unbindAgentSession}.
   *
   * @param agentSessionId The agent session's id, as the tool registry gives it.
   * @param owner The owner: not blank, at most {@link Resources.maximumOwnerLength} UTF-16 code units.
   * @throws {@link ArgumentException} Synchronously, when the session id is not an identifier, or the owner is blank or too long.
   *
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   * import { RuntimeTerminalOwners } from "@noldova/terminal.protocol";
   *
   * export function bindChatAgent(context: IRuntimePartContext, agentSessionId: string, chatId: string): void {
   *   context.getService("terminal.owners", RuntimeTerminalOwners).bindAgentSession(agentSessionId, `example.chat/${chatId}`);
   * }
   * ```
   */
  public abstract bindAgentSession(agentSessionId: string, owner: string): void;

  /**
   * Unties an agent session from the owner {@link RuntimeTerminalOwners.bindAgentSession} gave it: from then on it takes its `terminal.owner`
   * binding's owner, or none. The terminals it opened with the owner keep it. A session that isn't bound stays as it is.
   *
   * @param agentSessionId The agent session's id.
   * @throws {@link ArgumentException} Synchronously, when the session id is not an identifier.
   *
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   * import { RuntimeTerminalOwners } from "@noldova/terminal.protocol";
   *
   * export function unbindChatAgent(context: IRuntimePartContext, agentSessionId: string): void {
   *   context.getService("terminal.owners", RuntimeTerminalOwners).unbindAgentSession(agentSessionId);
   * }
   * ```
   */
  public abstract unbindAgentSession(agentSessionId: string): void;
}
/**
 * The window part's acknowledgement that one of its panes has drawn a terminal's output up to an offset, which lets the runtime resume a
 * shell it paused for that pane.
 *
 * @example
 * ```ts
 * import { TerminalAckParams, TerminalNames } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.ackMethod, new TerminalAckParams("session-1", "pane-1", 4096).toJson());
 * ```
 */
export declare class TerminalAckParams {
  /**
   * The terminal's session ID.
   */
  public readonly sessionId: string;

  /**
   * The pane that drew the output.
   */
  public readonly paneId: string;

  /**
   * The output offset the pane has drawn up to, such as a batch's {@link TerminalOutput.endOffset}.
   */
  public readonly offset: number;

  /**
   * Creates an acknowledgement.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param paneId The pane's ID, with the same rules as the session ID.
   * @param offset The output offset drawn up to: an integer from `0` to {@link Resources.maximumOffset}.
   * @throws {@link ArgumentException} Synchronously, when an ID is blank or too long, or the offset isn't an integer in its range.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalAckParams } from "@noldova/terminal.protocol";
   *
   * const ack = new TerminalAckParams("session-1", "pane-1", 0);
   * try {
   *   new TerminalAckParams("session-1", "pane-1", -1);
   * }
   * catch (error) {
   *   console.log(ack.offset, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(sessionId: string, paneId: string, offset: number);

  /**
   * Reads an acknowledgement from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `sessionId`, `paneId` and `offset`.
   * @returns The acknowledgement.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field is missing, unknown, of the wrong type or
   * breaks the constructor's rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalAckParams } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalAckParams.fromJson({ sessionId: "session-1", paneId: "pane-1", offset: 4096 }).offset);
   * ```
   */
  public static fromJson(value: unknown): TerminalAckParams;

  /**
   * Gives the acknowledgement's wire form.
   *
   * @returns A new plain object that {@link TerminalAckParams.fromJson} reads back to an equal acknowledgement.
   *
   * @example
   * ```ts
   * import { TerminalAckParams } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalAckParams("session-1", "pane-1", 4096).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime's answer to a pane that attaches to a terminal: its screen, the output since, and what the pane shows around it.
 *
 * @remarks
 * The snapshot and the pending tail together stand for the terminal's output up to {@link TerminalAttachment.offset}; the pane writes the
 * snapshot, then the pending tail, then the output from that offset on.
 * The stored range numbers the lines above the snapshot, which the pane pages in through {@link TerminalLinesParams} as the person
 * scrolls past its scrollback.
 *
 * @example
 * ```ts
 * import { TerminalAttachment, TerminalLineRange, TerminalShellKind, TerminalSize } from "@noldova/terminal.protocol";
 *
 * const attachment = new TerminalAttachment("session-1", "$ ", "", 2, new TerminalSize(80, 24), "", null, null, null, new TerminalLineRange(0, 0),
 *   null, [], TerminalShellKind.Bash);
 * console.log(attachment.toJson());
 * ```
 */
export declare class TerminalAttachment {
  /**
   * The terminal's session ID.
   */
  public readonly sessionId: string;

  /**
   * The terminal's screen and scrollback, serialized as the escape sequences that draw them.
   */
  public readonly snapshot: string;

  /**
   * The unfinished escape sequence at the end of the output, which the snapshot can't hold; empty when there is none.
   */
  public readonly pending: string;

  /**
   * The output offset the snapshot and pending tail reach.
   */
  public readonly offset: number;

  /**
   * The terminal's size.
   */
  public readonly size: TerminalSize;

  /**
   * The terminal's title; empty when the shell set none.
   */
  public readonly title: string;

  /**
   * The working folder the shell last reported, or `null` before the first report and for a shell without integration.
   */
  public readonly cwd: string | null;

  /**
   * How the shell ended, or `null` while it runs.
   */
  public readonly exit: TerminalExit | null;

  /**
   * The Windows pseudo-terminal the shell runs in, or `null` on other platforms.
   */
  public readonly windowsPty: WindowsPty | null;

  /**
   * The terminal's stored lines as they stood when the snapshot was taken.
   */
  public readonly stored: TerminalLineRange;

  /**
   * Where the shell's line for the person's command starts on the snapshot, or `null` outside a prompt, on the alternate screen, for a shell
   * without the integration and for an agent's terminal.
   */
  public readonly input: TerminalInputStart | null;

  /**
   * The earlier commands of the terminal's shell in this run, newest first, which its panes suggest from; empty for an agent's terminal.
   */
  public readonly commands: readonly string[];

  /**
   * The kind of shell the terminal runs, which its panes read the typed line as.
   */
  public readonly shellKind: TerminalShellKind;

  /**
   * Creates an attachment.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param snapshot The serialized screen: at most {@link Resources.maximumSnapshotLength} UTF-16 code units, and may be empty.
   * @param pending The unfinished escape sequence: at most {@link Resources.maximumOutputLength} UTF-16 code units, and may be empty.
   * @param offset The output offset the snapshot and pending tail reach: an integer from `0` to {@link Resources.maximumOffset}.
   * @param size The terminal's size.
   * @param title The terminal's title: at most {@link Resources.maximumTitleLength} UTF-16 code units, and may be empty.
   * @param cwd The last working folder: `null`, or not blank and at most {@link Resources.maximumPathLength} UTF-16 code units.
   * @param exit How the shell ended, or `null` while it runs.
   * @param windowsPty The Windows pseudo-terminal, or `null` on other platforms.
   * @param stored The stored lines when the snapshot was taken.
   * @param input Where the shell's line starts, or `null` for none.
   * @param commands The earlier commands, newest first: at most {@link Resources.maximumSuggestedCommands}, each not blank and at most
   * {@link Resources.maximumSuggestionLength} UTF-16 code units; the attachment keeps its own copy.
   * @param shellKind The kind of shell the terminal runs.
   * @throws {@link ArgumentException} Synchronously, when the session ID is blank or too long, a string is longer than its limit, the
   * working folder or a command is blank, the offset isn't an integer in its range, or there are too many commands.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalAttachment, TerminalLineRange, TerminalShellKind, TerminalSize } from "@noldova/terminal.protocol";
   *
   * const size = new TerminalSize(80, 24);
   * const stored = new TerminalLineRange(0, 0);
   * const attachment = new TerminalAttachment("session-1", "", "", 0, size, "", "/home/user", null, null, stored, null, [], TerminalShellKind.Bash);
   * try {
   *   new TerminalAttachment("session-1", "", "", 0, size, "", " ", null, null, stored, null, [], TerminalShellKind.Bash);
   * }
   * catch (error) {
   *   console.log(attachment.cwd, error instanceof ArgumentException);
   * }
   * ```
   */
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
    shellKind: TerminalShellKind);

  /**
   * Reads an attachment from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `sessionId`, `snapshot`, `pending`, `offset`, `size`,
   * `title`, `cwd`, `exit`, `windowsPty`, `stored`, `input`, `commands` and `shellKind`, where `cwd`, `exit`, `windowsPty` and `input` may
   * be `null`.
   * @returns The attachment.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field, or a field of `size`, `exit`,
   * `windowsPty`, `stored` or `input`, or a command or the shell's kind, is missing, unknown, of the wrong type or out of its range, or
   * when `stored` ends before it starts or counts more dropped lines than lie before its start; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalAttachment } from "@noldova/terminal.protocol";
   *
   * const attachment = TerminalAttachment.fromJson({
   *   sessionId: "session-1",
   *   snapshot: "$ ",
   *   pending: "",
   *   offset: 2,
   *   size: { cols: 80, rows: 24 },
   *   title: "",
   *   cwd: null,
   *   exit: null,
   *   windowsPty: { backend: "conpty", buildNumber: 22631 },
   *   stored: { start: 0, end: 0, dropped: 0 },
   *   input: { rowsAbove: 0, column: 2, rightPrompt: null },
   *   commands: ["npm test"],
   *   shellKind: "Bash"
   * });
   * console.log(attachment.windowsPty?.buildNumber);
   * ```
   */
  public static fromJson(value: unknown): TerminalAttachment;

  /**
   * Gives the attachment's wire form.
   *
   * @returns A new plain object that {@link TerminalAttachment.fromJson} reads back to an equal attachment.
   *
   * @example
   * ```ts
   * import { TerminalAttachment, TerminalLineRange, TerminalShellKind, TerminalSize } from "@noldova/terminal.protocol";
   *
   * const attachment = new TerminalAttachment("session-1", "", "", 0, new TerminalSize(80, 24), "", null, null, null, new TerminalLineRange(0, 0),
   *   null, [], TerminalShellKind.Bash);
   * console.log(attachment.toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime's event that the person started a command in a terminal of the same shell as this one, newer than every earlier one, which
 * the terminal's panes may now suggest; it goes to every terminal of that shell a person types in, not to an agent's.
 *
 * @example
 * ```ts
 * import { TerminalCommandAdded, TerminalNames } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.commandAddedEvent, new TerminalCommandAdded("session-1", "npm test").toJson());
 * ```
 */
export declare class TerminalCommandAdded {
  /**
   * The session ID of the terminal whose panes may suggest the command.
   */
  public readonly sessionId: string;

  /**
   * The command's first line, without the white space around it.
   */
  public readonly command: string;

  /**
   * Creates the event.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param command The command: not blank, at most {@link Resources.maximumSuggestionLength} UTF-16 code units.
   * @throws {@link ArgumentException} Synchronously, when the session ID or the command is blank or too long.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalCommandAdded } from "@noldova/terminal.protocol";
   *
   * const added = new TerminalCommandAdded("session-1", "git status");
   * try {
   *   new TerminalCommandAdded("session-1", " ");
   * }
   * catch (error) {
   *   console.log(added.command, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(sessionId: string, command: string);

  /**
   * Reads the event from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `sessionId` and `command`.
   * @returns The event.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field is missing, unknown, of the wrong type,
   * blank or too long; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalCommandAdded } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalCommandAdded.fromJson({ sessionId: "session-1", command: "ls -la" }).command);
   * ```
   */
  public static fromJson(value: unknown): TerminalCommandAdded;

  /**
   * Gives the event's wire form.
   *
   * @returns A new plain object that {@link TerminalCommandAdded.fromJson} reads back to an equal event.
   *
   * @example
   * ```ts
   * import { TerminalCommandAdded } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalCommandAdded("session-1", "make").toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime's event that a launched terminal's command ended: the first command end the shell integration marks after the runtime typed the
 * launch's command, with its exit code, or `null` when it can't be told.
 *
 * @example
 * ```ts
 * import { TerminalCommandEnded, TerminalNames } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.launchCommandEndedEvent, new TerminalCommandEnded("session-1", 0).toJson());
 * ```
 */
export declare class TerminalCommandEnded {
  /**
   * The terminal's session ID.
   */
  public readonly sessionId: string;

  /**
   * The command's exit code, or `null` when the shell gave none or the command's end can't be told, as for a shell without the integration.
   */
  public readonly exitCode: number | null;

  /**
   * Creates the event.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param exitCode The exit code: `null`, or an integer from {@link Resources.minimumExitCode} to {@link Resources.maximumExitCode}.
   * @throws {@link ArgumentException} Synchronously, when the session ID is blank or too long, or the exit code isn't such an integer.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalCommandEnded } from "@noldova/terminal.protocol";
   *
   * const ended = new TerminalCommandEnded("session-1", 1);
   * try {
   *   new TerminalCommandEnded("session-1", 1.5);
   * }
   * catch (error) {
   *   console.log(ended.exitCode, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(sessionId: string, exitCode: number | null);

  /**
   * Reads the event from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `sessionId` and `exitCode`.
   * @returns The event.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field is missing, unknown, of the wrong type or
   * breaks the constructor's rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalCommandEnded } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalCommandEnded.fromJson({ sessionId: "session-1", exitCode: null }).exitCode);
   * ```
   */
  public static fromJson(value: unknown): TerminalCommandEnded;

  /**
   * Gives the event's wire form.
   *
   * @returns A new plain object that {@link TerminalCommandEnded.fromJson} reads back to an equal event.
   *
   * @example
   * ```ts
   * import { TerminalCommandEnded } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalCommandEnded("session-1", 0).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Asks what can follow at the cursor of a terminal's line, which {@link TerminalNames.completeMethod} takes.
 *
 * @example
 * ```ts
 * import { TerminalCompleteParams, TerminalNames } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.completeMethod, new TerminalCompleteParams("session-1", "git checkout ma", 15).toJson());
 * ```
 */
export declare class TerminalCompleteParams {
  /**
   * The terminal's session ID.
   */
  public readonly sessionId: string;

  /**
   * The shell's line as the pane reads it from its screen, from where the shell's line starts.
   */
  public readonly line: string;

  /**
   * Where the cursor is in the line, in UTF-16 code units; only the text before it counts.
   */
  public readonly cursor: number;

  /**
   * Whether the person pressed a key to complete, so the runtime may ask the shell's own completers for the command's options; never while
   * the person types.
   */
  public readonly asksShell: boolean;

  /**
   * Creates the request.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param line The line: at most {@link Resources.maximumSuggestionLength} UTF-16 code units, and may be empty.
   * @param cursor The cursor: an integer from `0` to the line's length.
   * @param asksShell Whether the person pressed a key to complete; `false` when left out.
   * @throws {@link ArgumentException} Synchronously, when the session ID is blank or too long, the line is too long, or the cursor isn't an
   * integer within the line.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalCompleteParams } from "@noldova/terminal.protocol";
   *
   * const request = new TerminalCompleteParams("session-1", "ls sr", 5);
   * try {
   *   new TerminalCompleteParams("session-1", "ls", 3);
   * }
   * catch (error) {
   *   console.log(request.cursor, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(sessionId: string, line: string, cursor: number, asksShell?: boolean);

  /**
   * Reads the request from its wire form.
   *
   * @param value The wire form, untrusted: an object with the fields `sessionId`, `line` and `cursor`, each required, and `asksShell`,
   * `false` when absent; no others.
   * @returns The request.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field is missing, unknown, of the wrong type or
   * breaks the constructor's rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalCompleteParams } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalCompleteParams.fromJson({ sessionId: "session-1", line: "ls sr", cursor: 5 }).line);
   * ```
   */
  public static fromJson(value: unknown): TerminalCompleteParams;

  /**
   * Gives the request's wire form.
   *
   * @returns A new plain object that {@link TerminalCompleteParams.fromJson} reads back to an equal request.
   *
   * @example
   * ```ts
   * import { TerminalCompleteParams } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalCompleteParams("session-1", "npm run ", 8).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Asks which of the command names typed at a terminal's prompt its shell would find, which {@link TerminalNames.findCommandsMethod} takes.
 *
 * @example
 * ```ts
 * import { TerminalFindCommandsParams, TerminalNames } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.findCommandsMethod, new TerminalFindCommandsParams("session-1", ["git", "gti"]).toJson());
 * ```
 */
export declare class TerminalFindCommandsParams {
  /**
   * The terminal's session ID.
   */
  public readonly sessionId: string;

  /**
   * The command names, as the pane reads them from its screen.
   */
  public readonly names: readonly string[];

  /**
   * Creates the request.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param names The names, as {@link ArgumentValidator.requireCommandNames} checks them.
   * @throws {@link ArgumentException} Synchronously, when the session ID is blank or too long, there are too many names, or one is blank or
   * too long.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalFindCommandsParams } from "@noldova/terminal.protocol";
   *
   * try {
   *   new TerminalFindCommandsParams("session-1", [" "]);
   * }
   * catch (error) {
   *   console.log(error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(sessionId: string, names: readonly string[]);

  /**
   * Reads the request from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `sessionId` and `names`.
   * @returns The request.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field is missing, unknown, of the wrong type or
   * breaks the constructor's rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalFindCommandsParams } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalFindCommandsParams.fromJson({ sessionId: "session-1", names: ["ls"] }).names);
   * ```
   */
  public static fromJson(value: unknown): TerminalFindCommandsParams;

  /**
   * Gives the request's wire form.
   *
   * @returns A new plain object that {@link TerminalFindCommandsParams.fromJson} reads back to an equal request.
   *
   * @example
   * ```ts
   * import { TerminalFindCommandsParams } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalFindCommandsParams("session-1", ["npm"]).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The asked names a shell would find nowhere, which {@link TerminalNames.findCommandsMethod} answers with: not among its builtins, its
 * aliases and functions, or the programs on its PATH. A shell the runtime can't answer for gives none, so a name is never missing on a guess.
 *
 * @example
 * ```ts
 * import { TerminalMissingCommands } from "@noldova/terminal.protocol";
 *
 * console.log(new TerminalMissingCommands(["gti"]).toJson());
 * ```
 */
export declare class TerminalMissingCommands {
  /**
   * The missing names, in the order asked.
   */
  public readonly names: readonly string[];

  /**
   * Creates the answer.
   *
   * @param names The names, as {@link ArgumentValidator.requireCommandNames} checks them.
   * @throws {@link ArgumentException} Synchronously, when there are too many names, or one is blank or too long.
   *
   * @example
   * ```ts
   * import { TerminalMissingCommands } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalMissingCommands([]).names.length);
   * ```
   */
  public constructor(names: readonly string[]);

  /**
   * Reads the answer from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the field `names`.
   * @returns The answer.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or the field is missing, unknown, of the wrong type or
   * breaks the constructor's rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalMissingCommands } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalMissingCommands.fromJson({ names: ["gti"] }).names);
   * ```
   */
  public static fromJson(value: unknown): TerminalMissingCommands;

  /**
   * Gives the answer's wire form.
   *
   * @returns A new plain object that {@link TerminalMissingCommands.fromJson} reads back to an equal answer.
   *
   * @example
   * ```ts
   * import { TerminalMissingCommands } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalMissingCommands(["gti"]).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One choice of a {@link TerminalCompletion}: the text the shell gets, the name the list shows and what it is.
 *
 * @example
 * ```ts
 * import { TerminalCompletionItem, TerminalCompletionKind } from "@noldova/terminal.protocol";
 *
 * console.log(new TerminalCompletionItem("My\\ Documents/", "My Documents/", TerminalCompletionKind.Folder).toJson());
 * ```
 */
export declare class TerminalCompletionItem {
  /**
   * The word as the shell reads it back, quoted and escaped for the shell's line, which replaces the line from
   * {@link TerminalCompletion.replaceFrom} up to the cursor.
   */
  public readonly text: string;

  /**
   * The name the list shows, without the shell's quoting.
   */
  public readonly label: string;

  /**
   * What the choice is.
   */
  public readonly kind: TerminalCompletionKind;

  /**
   * Creates the choice.
   *
   * @param text The text: not blank, at most {@link Resources.maximumPathLength} UTF-16 code units, with no character {@link Resources.controlCharacters} matches.
   * @param label The name: not blank, at most {@link Resources.maximumPathLength} UTF-16 code units.
   * @param kind What it is.
   * @throws {@link ArgumentException} Synchronously, when the text or the name is blank or too long, or the text holds a control character.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalCompletionItem, TerminalCompletionKind } from "@noldova/terminal.protocol";
   *
   * const item = new TerminalCompletionItem("main", "main", TerminalCompletionKind.Branch);
   * try {
   *   new TerminalCompletionItem(" ", "main", TerminalCompletionKind.Branch);
   * }
   * catch (error) {
   *   console.log(item.text, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(text: string, label: string, kind: TerminalCompletionKind);

  /**
   * Reads a choice from a reader of its wire form, as a completion does.
   *
   * @param reader A reader of the wire form: an object with exactly the fields `text`, `label` and `kind`.
   * @returns The choice.
   * @throws {@link JsonException} Synchronously, when a field is missing or unknown, `text` or `label` isn't a string that has text within
   * {@link Resources.maximumPathLength} UTF-16 code units, or `kind` isn't one of {@link TerminalCompletionKind}'s wire values; the
   * exception's path names the field.
   *
   * @example
   * ```ts
   * import { ProtocolReader, TerminalCompletionItem } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalCompletionItem.fromReader(ProtocolReader.fromValue({ text: "main", label: "main", kind: "Branch" })).label);
   * ```
   */
  public static fromReader(reader: ProtocolReader): TerminalCompletionItem;

  /**
   * Gives the choice's wire form.
   *
   * @returns A new plain object with the fields `text`, `label` and `kind`, which {@link TerminalCompletion.fromJson} reads back within
   * its `items`.
   *
   * @example
   * ```ts
   * import { TerminalCompletionItem, TerminalCompletionKind } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalCompletionItem("build", "build", TerminalCompletionKind.Script).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * What can follow at the cursor, which {@link TerminalNames.completeMethod} answers with: the choices, sorted by name, and where in the line
 * each one's text starts.
 *
 * @example
 * ```ts
 * import { TerminalCompletion, TerminalCompletionItem, TerminalCompletionKind } from "@noldova/terminal.protocol";
 *
 * console.log(new TerminalCompletion(13, [new TerminalCompletionItem("main", "main", TerminalCompletionKind.Branch)]).toJson());
 * ```
 */
export declare class TerminalCompletion {
  /**
   * Where the cursor's word starts in the line, in UTF-16 code units: a choice replaces the line from here up to the cursor.
   */
  public readonly replaceFrom: number;

  /**
   * The choices, at most {@link Resources.maximumCompletionItems}; none when nothing fits or the shell is one the runtime doesn't read.
   */
  public readonly items: readonly TerminalCompletionItem[];

  /**
   * Whether the shell's completers didn't answer in time, so the runtime gave the shell a plain Tab in place of a list; the items are then
   * none.
   */
  public readonly isShellTab: boolean;

  /**
   * Creates the answer.
   *
   * @param replaceFrom Where the word starts: an integer from `0` to {@link Resources.maximumSuggestionLength}.
   * @param items The choices: at most {@link Resources.maximumCompletionItems}.
   * @param isShellTab Whether the shell got a plain Tab in place of a list; `false` when left out.
   * @throws {@link ArgumentException} Synchronously, when the start isn't an integer in its range, or there are too many choices.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalCompletion } from "@noldova/terminal.protocol";
   *
   * const completion = new TerminalCompletion(0, []);
   * try {
   *   new TerminalCompletion(-1, []);
   * }
   * catch (error) {
   *   console.log(completion.items.length, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(replaceFrom: number, items: readonly TerminalCompletionItem[], isShellTab?: boolean);

  /**
   * Reads the answer from its wire form.
   *
   * @param value The wire form, untrusted: an object with the fields `replaceFrom` and `items`, each required, and `isShellTab`, `false`
   * when absent, and no others; each item an object with exactly the fields `text`, `label` and `kind`.
   * @returns The answer.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field is missing, unknown, of the wrong type or
   * breaks the constructor's rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalCompletion } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalCompletion.fromJson({ replaceFrom: 3, items: [{ text: "src/", label: "src/", kind: "Folder" }] }).items.length);
   * ```
   */
  public static fromJson(value: unknown): TerminalCompletion;

  /**
   * Gives the answer's wire form.
   *
   * @returns A new plain object that {@link TerminalCompletion.fromJson} reads back to an equal answer.
   *
   * @example
   * ```ts
   * import { TerminalCompletion } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalCompletion(0, []).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime's event that a terminal's shell reported a new working folder.
 *
 * @example
 * ```ts
 * import { TerminalCwd, TerminalNames } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.cwdChangedEvent, new TerminalCwd("session-1", "/home/user").toJson());
 * ```
 */
export declare class TerminalCwd {
  /**
   * The terminal's session ID.
   */
  public readonly sessionId: string;

  /**
   * The shell's new working folder.
   */
  public readonly cwd: string;

  /**
   * Creates the event.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param cwd The working folder: not blank, at most {@link Resources.maximumPathLength} UTF-16 code units.
   * @throws {@link ArgumentException} Synchronously, when the session ID or the folder is blank or too long.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalCwd } from "@noldova/terminal.protocol";
   *
   * const cwd = new TerminalCwd("session-1", "/home/user");
   * try {
   *   new TerminalCwd("session-1", "");
   * }
   * catch (error) {
   *   console.log(cwd.cwd, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(sessionId: string, cwd: string);

  /**
   * Reads the event from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `sessionId` and `cwd`.
   * @returns The event.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field is missing, unknown, of the wrong type or
   * breaks the constructor's rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalCwd } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalCwd.fromJson({ sessionId: "session-1", cwd: "/home/user" }).cwd);
   * ```
   */
  public static fromJson(value: unknown): TerminalCwd;

  /**
   * Gives the event's wire form.
   *
   * @returns A new plain object that {@link TerminalCwd.fromJson} reads back to an equal event.
   *
   * @example
   * ```ts
   * import { TerminalCwd } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalCwd("session-1", "/home/user").toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * How a terminal's shell ended: its exit code and what ended it.
 *
 * @example
 * ```ts
 * import { EndedBy, TerminalExit } from "@noldova/terminal.protocol";
 *
 * console.log(new TerminalExit(1, EndedBy.Exit).toJson());
 * ```
 */
export declare class TerminalExit {
  /**
   * The shell's exit code, or `null` when it gave none.
   */
  public readonly exitCode: number | null;

  /**
   * What ended the shell.
   */
  public readonly endedBy: EndedBy;

  /**
   * Creates an exit.
   *
   * @param exitCode The exit code: `null`, or an integer from {@link Resources.minimumExitCode} to {@link Resources.maximumExitCode}.
   * @param endedBy What ended the shell.
   * @throws {@link ArgumentException} Synchronously, when the exit code isn't `null` and isn't an integer in its range.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { EndedBy, TerminalExit } from "@noldova/terminal.protocol";
   *
   * const exit = new TerminalExit(null, EndedBy.Close);
   * try {
   *   new TerminalExit(1.5, EndedBy.Exit);
   * }
   * catch (error) {
   *   console.log(exit.exitCode, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(exitCode: number | null, endedBy: EndedBy);

  /**
   * Reads an exit from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `exitCode`, which may be `null`, and `endedBy`.
   * @returns The exit.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, a field is missing or unknown, the exit code isn't
   * `null` or an integer in its range, or `endedBy` isn't one of {@link EndedBy}'s values; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalExit } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalExit.fromJson({ exitCode: 0, endedBy: "Exit" }).endedBy);
   * ```
   */
  public static fromJson(value: unknown): TerminalExit;

  /**
   * Reads an exit from a reader of its wire form, as a message that holds one does.
   *
   * @param reader A reader of the wire form, which {@link TerminalExit.fromJson} describes.
   * @returns The exit.
   * @throws {@link JsonException} Synchronously, as {@link TerminalExit.fromJson} does, with paths under the reader's path.
   *
   * @example
   * ```ts
   * import { ProtocolReader, TerminalExit } from "@noldova/terminal.protocol";
   *
   * const reader = ProtocolReader.fromValue({ exit: { exitCode: null, endedBy: "Close" } });
   * console.log(TerminalExit.fromReader(reader.readObject("exit")).endedBy);
   * ```
   */
  public static fromReader(reader: ProtocolReader): TerminalExit;

  /**
   * Gives the exit's wire form.
   *
   * @returns A new plain object that {@link TerminalExit.fromJson} reads back to an equal exit.
   *
   * @example
   * ```ts
   * import { EndedBy, TerminalExit } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalExit(0, EndedBy.Exit).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime's event that a terminal's shell ended.
 *
 * @example
 * ```ts
 * import { EndedBy, TerminalExit, TerminalExited, TerminalNames } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.exitedEvent, new TerminalExited("session-1", new TerminalExit(0, EndedBy.Exit)).toJson());
 * ```
 */
export declare class TerminalExited {
  /**
   * The terminal's session ID.
   */
  public readonly sessionId: string;

  /**
   * How the shell ended.
   */
  public readonly exit: TerminalExit;

  /**
   * Creates the event.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param exit How the shell ended.
   * @throws {@link ArgumentException} Synchronously, when the session ID is blank or too long.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { EndedBy, TerminalExit, TerminalExited } from "@noldova/terminal.protocol";
   *
   * const exit = new TerminalExit(0, EndedBy.Exit);
   * const exited = new TerminalExited("session-1", exit);
   * try {
   *   new TerminalExited("", exit);
   * }
   * catch (error) {
   *   console.log(exited.sessionId, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(sessionId: string, exit: TerminalExit);

  /**
   * Reads the event from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `sessionId` and `exit`.
   * @returns The event.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field, or a field of `exit`, is missing,
   * unknown, of the wrong type or breaks its rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalExited } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalExited.fromJson({ sessionId: "session-1", exit: { exitCode: 0, endedBy: "Exit" } }).exit.exitCode);
   * ```
   */
  public static fromJson(value: unknown): TerminalExited;

  /**
   * Gives the event's wire form.
   *
   * @returns A new plain object that {@link TerminalExited.fromJson} reads back to an equal event.
   *
   * @example
   * ```ts
   * import { EndedBy, TerminalExit, TerminalExited } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalExited("session-1", new TerminalExit(null, EndedBy.Close)).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The window part's request that the runtime write text to a terminal's shell, as typing does.
 *
 * @example
 * ```ts
 * import { TerminalInputParams, TerminalNames } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.inputMethod, new TerminalInputParams("session-1", "ls\r").toJson());
 * ```
 */
export declare class TerminalInputParams {
  /**
   * The terminal's session ID.
   */
  public readonly sessionId: string;

  /**
   * The text to write, escape sequences included.
   */
  public readonly data: string;

  /**
   * Creates the request.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param data The text to write: at most {@link Resources.maximumInputLength} UTF-16 code units, and may be empty.
   * @throws {@link ArgumentException} Synchronously, when the session ID is blank or too long, or the text is too long.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalInputParams } from "@noldova/terminal.protocol";
   *
   * const input = new TerminalInputParams("session-1", "");
   * try {
   *   new TerminalInputParams(" ", "ls\r");
   * }
   * catch (error) {
   *   console.log(input.data.length, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(sessionId: string, data: string);

  /**
   * Reads the request from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `sessionId` and `data`.
   * @returns The request.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field is missing, unknown, of the wrong type or
   * breaks the constructor's rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalInputParams } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalInputParams.fromJson({ sessionId: "session-1", data: "ls\r" }).data);
   * ```
   */
  public static fromJson(value: unknown): TerminalInputParams;

  /**
   * Gives the request's wire form.
   *
   * @returns A new plain object that {@link TerminalInputParams.fromJson} reads back to an equal request.
   *
   * @example
   * ```ts
   * import { TerminalInputParams } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalInputParams("session-1", "exit\r").toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * An edge of the shell's line for the person's command at an offset of a terminal's output, where the shell integration's mark ended, so a
 * pane that has drawn the output up to there finds the line's start at its cursor.
 *
 * @example
 * ```ts
 * import { TerminalInputEdge, TerminalInputMark } from "@noldova/terminal.protocol";
 *
 * console.log(new TerminalInputMark(120, TerminalInputEdge.End).toJson());
 * ```
 */
export declare class TerminalInputMark {
  /**
   * The output offset of the edge.
   */
  public readonly offset: number;

  /**
   * Whether the line starts or ends there.
   */
  public readonly edge: TerminalInputEdge;

  /**
   * Creates a mark.
   *
   * @param offset The edge's offset: an integer from `0` to {@link Resources.maximumOffset}.
   * @param edge Whether the line starts or ends there.
   * @throws {@link ArgumentException} Synchronously, when the offset isn't an integer in its range.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalInputEdge, TerminalInputMark } from "@noldova/terminal.protocol";
   *
   * const mark = new TerminalInputMark(0, TerminalInputEdge.Start);
   * try {
   *   new TerminalInputMark(-1, TerminalInputEdge.Start);
   * }
   * catch (error) {
   *   console.log(mark.edge, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(offset: number, edge: TerminalInputEdge);

  /**
   * Reads a mark from a reader of its wire form, as a batch does.
   *
   * @param reader A reader of the wire form: an object with exactly the fields `offset` and `edge`.
   * @returns The mark.
   * @throws {@link JsonException} Synchronously, when a field is missing or unknown, `offset` isn't an integer from `0` to
   * {@link Resources.maximumOffset}, or `edge` isn't one of {@link TerminalInputEdge}'s wire values; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { ProtocolReader, TerminalInputMark } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalInputMark.fromReader(ProtocolReader.fromValue({ offset: 4, edge: "Start" })).offset);
   * ```
   */
  public static fromReader(reader: ProtocolReader): TerminalInputMark;

  /**
   * Gives the mark's wire form.
   *
   * @returns A new plain object that {@link TerminalInputMark.fromReader} reads back to an equal mark.
   *
   * @example
   * ```ts
   * import { TerminalInputEdge, TerminalInputMark } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalInputMark(8, TerminalInputEdge.End).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Where the shell's line for the person's command starts on an attachment's snapshot, by rows above the cursor's row and the column on that
 * row, so a pane that drew the snapshot finds it whatever scrollback it keeps above.
 *
 * @example
 * ```ts
 * import { TerminalInputStart } from "@noldova/terminal.protocol";
 *
 * console.log(new TerminalInputStart(1, 2).toJson());
 * ```
 */
export declare class TerminalInputStart {
  /**
   * How many rows above the cursor's row the line starts; `0` on the cursor's row.
   */
  public readonly rowsAbove: number;

  /**
   * The column the line starts at, from `0`.
   */
  public readonly column: number;

  /**
   * The column where the prompt's right part starts on the line's row, from `0`, as the shell integration marked it, or `null` when it
   * marked none.
   */
  public readonly rightPrompt: number | null;

  /**
   * Creates a start.
   *
   * @param rowsAbove The rows above: an integer from `0` to {@link Resources.maximumOffset}.
   * @param column The column: an integer from `0` to {@link Resources.maximumColumns}.
   * @param rightPrompt The right prompt's column: an integer from `0` to {@link Resources.maximumColumns}, or `null`, the default.
   * @throws {@link ArgumentException} Synchronously, when a number isn't an integer in its range.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalInputStart } from "@noldova/terminal.protocol";
   *
   * const start = new TerminalInputStart(0, 2);
   * try {
   *   new TerminalInputStart(0, -1);
   * }
   * catch (error) {
   *   console.log(start.column, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(rowsAbove: number, column: number, rightPrompt?: number | null);

  /**
   * Reads a start from a reader of its wire form, as an attachment does.
   *
   * @param reader A reader of the wire form: an object with the fields `rowsAbove`, `column` and `rightPrompt`, which is `null` when there is
   * no right prompt.
   * @returns The start.
   * @throws {@link JsonException} Synchronously, when a field is missing, unknown, or isn't an integer in its range; the exception's
   * path names the field.
   *
   * @example
   * ```ts
   * import { ProtocolReader, TerminalInputStart } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalInputStart.fromReader(ProtocolReader.fromValue({ rowsAbove: 0, column: 2, rightPrompt: null })).column);
   * ```
   */
  public static fromReader(reader: ProtocolReader): TerminalInputStart;

  /**
   * Gives the start's wire form.
   *
   * @returns A new plain object that {@link TerminalInputStart.fromReader} reads back to an equal start.
   *
   * @example
   * ```ts
   * import { TerminalInputStart } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalInputStart(2, 0).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * An app's request that the runtime launch a terminal; the runtime answers with a {@link TerminalLaunched}.
 *
 * @remarks
 * A launched terminal has no owner, isn't the panel's and isn't kept for the next run, so its variables are never stored. They lie over the
 * shell's environment, under the shell integration's own, and stay in the runtime's memory only while the terminal is open, so that a restart
 * starts the shell with them again. The notice shows above the shell's first output, dim, as a terminal's note does, and is never typed
 * into the shell. A folder that no longer exists is refused rather than opened elsewhere.
 *
 * @example
 * ```ts
 * import { TerminalLaunchParams, TerminalNames, TerminalSize } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.launchMethod, new TerminalLaunchParams(null, "/work", new TerminalSize(80, 24), undefined, { API_URL: "https://example.com" }).toJson());
 * ```
 */
export declare class TerminalLaunchParams {
  /**
   * The shell to run, one of {@link TerminalShells}' IDs, or `null` for the default shell.
   */
  public readonly shellId: string | null;

  /**
   * The folder the shell starts in, or `null` for the person's home folder.
   */
  public readonly folder: string | null;

  /**
   * The terminal's size.
   */
  public readonly size: TerminalSize;

  /**
   * The most bytes the terminal stores of the lines that leave its scrollback.
   */
  public readonly storedLimit: number;

  /**
   * The variables laid over the shell's environment, by name: a copy of the ones given.
   */
  public readonly environment: Readonly<Record<string, string>>;

  /**
   * The lines shown above the shell's first output, or `null` for none.
   */
  public readonly notice: string | null;

  /**
   * The command typed and entered into the shell once it is ready, or `null` for none.
   */
  public readonly command: string | null;

  /**
   * Whether a window opens the terminal's tab; `false` for a terminal the app shows only in its own page, which the list marks so.
   */
  public readonly opensTab: boolean;

  /**
   * The kinds of shell the terminal may run, or none for any: with kinds, the given shell, else the runtime's default, when it is of them, else
   * the first installed shell of them, as {@link TerminalRunParams} picks one.
   */
  public readonly shellKinds: readonly TerminalShellKind[];

  /**
   * Creates the request.
   *
   * @param shellId The shell's ID: `null`, or not blank and at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param folder The starting folder: `null`, or an absolute path of at most {@link Resources.maximumPathLength} UTF-16 code units.
   * @param size The terminal's size.
   * @param storedLimit The stored-line limit, in bytes: an integer from {@link Resources.minimumStoredLimit} to
   * {@link Resources.maximumStoredLimit}; {@link Resources.defaultStoredLimit} when left out.
   * @param environment The variables, as {@link ArgumentValidator.requireEnvironment} checks them; none when left out.
   * @param notice The notice: `null`, or not blank and at most {@link Resources.maximumNoticeLength} UTF-16 code units, whose line breaks
   * start new lines; `null` when left out.
   * @param command The command: `null`, or as {@link ArgumentValidator.requireCommand} checks it; `null` when left out.
   * @param opensTab Whether a window opens the terminal's tab; `true` when left out.
   * @param shellKinds The kinds of shell the terminal may run, each one of {@link TerminalShellKind}'s; none, any shell, when left out.
   * @throws {@link ArgumentException} Synchronously, when the shell ID is blank or too long, the folder is blank, too long or relative, the
   * limit isn't an integer in its range, a variable is refused, the notice is blank or too long, the command is refused, or a kind isn't one; a refusal never
   * carries a variable's value.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalLaunchParams, TerminalSize } from "@noldova/terminal.protocol";
   *
   * try {
   *   new TerminalLaunchParams(null, null, new TerminalSize(80, 24), undefined, { TERM: "dumb" });
   * }
   * catch (error) {
   *   console.log(error instanceof ArgumentException && error.parameterName);
   * }
   * ```
   */
  public constructor(shellId: string | null, folder: string | null, size: TerminalSize, storedLimit?: number,
    environment?: Readonly<Record<string, string>>, notice?: string | null, command?: string | null, opensTab?: boolean,
    shellKinds?: readonly TerminalShellKind[]);

  /**
   * Reads the request from its wire form.
   *
   * @param value The wire form, untrusted: an object with the fields `shellId`, `folder`, `notice` and `command`, which may be `null`, and
   * `size`, `storedLimit`, `environment`, an object of strings, and `opensTab`, a boolean, each required, and `shellKinds`, an array of
   * {@link TerminalShellKind}'s values, none when left out; no others.
   * @returns The request.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field, or a field of `size` or `environment`, is
   * missing, unknown, of the wrong type or too long; the exception's path names the field, never a variable's value.
   * @throws {@link JsonException} Synchronously, also when the fields break the constructor's rules, at the field's path, with the
   * constructor's `ArgumentException` as its cause.
   *
   * @example
   * ```ts
   * import { TerminalLaunchParams } from "@noldova/terminal.protocol";
   *
   * const request = TerminalLaunchParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104857600,
   *   environment: {}, notice: "Run login to sign in.", command: null, opensTab: true });
   * console.log(request.notice);
   * ```
   */
  public static fromJson(value: unknown): TerminalLaunchParams;

  /**
   * Gives the request's wire form.
   *
   * @returns A new plain object that {@link TerminalLaunchParams.fromJson} reads back to an equal request; it holds `shellKinds` only when
   * the request has kinds, so a launch without them keeps the wire form a runtime from before kinds reads.
   *
   * @example
   * ```ts
   * import { TerminalLaunchParams, TerminalSize } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalLaunchParams(null, "/tmp", new TerminalSize(120, 40)).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime's answer to a {@link TerminalLaunchParams}: the terminal it launched, or the folder that no longer exists, when it opened
 * nothing. The answer carries the refusal, since a request's failure reaches the window without its reason.
 *
 * @example
 * ```ts
 * import { TerminalLaunched } from "@noldova/terminal.protocol";
 *
 * console.log(new TerminalLaunched("session-1", null).toJson(), new TerminalLaunched(null, "/gone").toJson());
 * ```
 */
export declare class TerminalLaunched {
  /**
   * The launched terminal's session, or `null` when nothing opened.
   */
  public readonly sessionId: string | null;

  /**
   * The folder that no longer exists, or `null` when the terminal opened.
   */
  public readonly missingFolder: string | null;

  /**
   * Creates the answer.
   *
   * @param sessionId The session's ID: `null`, or not blank and at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param missingFolder The missing folder: `null`, or an absolute path of at most {@link Resources.maximumPathLength} UTF-16 code units.
   * @throws {@link ArgumentException} Synchronously, when either breaks its rule, or both or neither are given.
   *
   * @example
   * ```ts
   * import { TerminalLaunched } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalLaunched("session-1", null).sessionId);
   * ```
   */
  public constructor(sessionId: string | null, missingFolder: string | null);

  /**
   * Reads the answer from its wire form.
   *
   * @param value The wire form, untrusted: an object with the fields `sessionId` and `missingFolder`, each required and either `null`; no
   * others.
   * @returns The answer.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field is missing, unknown, of the wrong type or too
   * long; the exception's path names the field.
   * @throws {@link JsonException} Synchronously, also when the fields break the constructor's rules, at the field's path, with the
   * constructor's `ArgumentException` as its cause.
   *
   * @example
   * ```ts
   * import { TerminalLaunched } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalLaunched.fromJson({ sessionId: null, missingFolder: "/gone" }).missingFolder);
   * ```
   */
  public static fromJson(value: unknown): TerminalLaunched;

  /**
   * Gives the answer's wire form.
   *
   * @returns A new plain object that {@link TerminalLaunched.fromJson} reads back to an equal answer.
   *
   * @example
   * ```ts
   * import { TerminalLaunched } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalLaunched("session-1", null).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime's answer to a {@link TerminalLinesParams}: the stored lines from a start, with the stored range as it stood when they were
 * read.
 *
 * @example
 * ```ts
 * import { Resources, TerminalLine, TerminalLinePage, TerminalLineRange, TerminalTextRun } from "@noldova/terminal.protocol";
 *
 * const line = new TerminalLine("ok", false, [new TerminalTextRun(2, Resources.defaultColor, Resources.defaultColor, 0)]);
 * console.log(new TerminalLinePage(10, [line], new TerminalLineRange(10, 12, 10)).toJson());
 * ```
 */
export declare class TerminalLinePage {
  /**
   * The number of the page's first line, counted from the terminal's first line.
   */
  public readonly start: number;

  /**
   * The page's lines, in order from {@link TerminalLinePage.start}; empty when none of the lines asked for is still kept.
   */
  public readonly lines: readonly TerminalLine[];

  /**
   * The terminal's stored lines when the page was read; the page's lines lie within it.
   */
  public readonly stored: TerminalLineRange;

  /**
   * Creates a page.
   *
   * @param start The number of the first line: an integer from `0` to {@link Resources.maximumOffset}.
   * @param lines The lines from the start, at most {@link Resources.maximumPageLines}, copied into a new array.
   * @param stored The stored range: it starts no later than the page and ends no earlier than the page's last line.
   * @throws {@link ArgumentException} Synchronously, when the start isn't an integer in its range, there are too many lines, or the lines
   * lie outside the stored range.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalLinePage, TerminalLineRange } from "@noldova/terminal.protocol";
   *
   * const page = new TerminalLinePage(10, [], new TerminalLineRange(10, 12, 10));
   * try {
   *   new TerminalLinePage(5, [], new TerminalLineRange(10, 12, 10));
   * }
   * catch (error) {
   *   console.log(page.lines.length, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(start: number, lines: readonly TerminalLine[], stored: TerminalLineRange);

  /**
   * Reads a page from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `start`, `lines` and `stored`.
   * @returns The page.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field, or a field of a line, a run or `stored`,
   * is missing, unknown, of the wrong type or out of its range; the exception's path names the field.
   * @throws {@link JsonException} Synchronously, at `lines` before it reads any line, when there are more than
   * {@link Resources.maximumPageLines} lines; and when the lines lie outside the stored range, a line's runs don't cover its text, a run's
   * color is no color, or `stored` breaks {@link TerminalLineRange}'s rules, at the field's path, with the constructor's
   * `ArgumentException` as its cause.
   *
   * @example
   * ```ts
   * import { TerminalLinePage } from "@noldova/terminal.protocol";
   *
   * const page = TerminalLinePage.fromJson({
   *   start: 0,
   *   lines: [{ text: "", wrapped: false, runs: [] }],
   *   stored: { start: 0, end: 1, dropped: 0 }
   * });
   * console.log(page.lines.length);
   * ```
   */
  public static fromJson(value: unknown): TerminalLinePage;

  /**
   * Gives the page's wire form.
   *
   * @returns A new plain object that {@link TerminalLinePage.fromJson} reads back to an equal page.
   *
   * @example
   * ```ts
   * import { TerminalLinePage, TerminalLineRange } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalLinePage(0, [], new TerminalLineRange(0, 0)).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A terminal's stored lines, numbered from its first line: those from {@link TerminalLineRange.start} up to, but not including,
 * {@link TerminalLineRange.end} are kept.
 *
 * @example
 * ```ts
 * import { TerminalLineRange } from "@noldova/terminal.protocol";
 *
 * const stored = new TerminalLineRange(200, 1200, 200);
 * console.log(stored.end - stored.start, stored.toJson());
 * ```
 */
export declare class TerminalLineRange {
  /**
   * The number of the first line still kept.
   */
  public readonly start: number;

  /**
   * The number after the last line kept; equal to the start when none is.
   */
  public readonly end: number;

  /**
   * How many of the lines before the start the stored-line limit dropped.
   */
  public readonly dropped: number;

  /**
   * Creates a range.
   *
   * @param start The first line kept: an integer from `0` to {@link Resources.maximumOffset}.
   * @param end The number after the last line kept: an integer from the start to {@link Resources.maximumOffset}.
   * @param dropped The lines dropped: an integer from `0` to the start; `0` when left out.
   * @throws {@link ArgumentException} Synchronously, when a number isn't an integer in its range, the end comes before the start, or more
   * lines are dropped than lie before the start.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalLineRange } from "@noldova/terminal.protocol";
   *
   * const empty = new TerminalLineRange(0, 0);
   * try {
   *   new TerminalLineRange(10, 5);
   * }
   * catch (error) {
   *   console.log(empty.dropped, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(start: number, end: number, dropped?: number);

  /**
   * Reads a range from a reader of its wire form, as a message that holds one does.
   *
   * @param reader A reader of the wire form: an object with exactly the fields `start`, `end` and `dropped`, each required.
   * @returns The range.
   * @throws {@link JsonException} Synchronously, when a field is missing, unknown, or isn't an integer from `0` to
   * {@link Resources.maximumOffset}; the exception's path names the field.
   * @throws {@link JsonException} Synchronously, also when the end comes before the start, or more lines are dropped than lie before the
   * start, at the field's path, with the constructor's `ArgumentException` as its cause.
   *
   * @example
   * ```ts
   * import { ProtocolReader, TerminalLineRange } from "@noldova/terminal.protocol";
   *
   * const reader = ProtocolReader.fromValue({ start: 0, end: 40, dropped: 0 });
   * console.log(TerminalLineRange.fromReader(reader).end);
   * ```
   */
  public static fromReader(reader: ProtocolReader): TerminalLineRange;

  /**
   * Gives the range's wire form.
   *
   * @returns A new plain object that {@link TerminalLineRange.fromReader} reads back to an equal range.
   *
   * @example
   * ```ts
   * import { TerminalLineRange } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalLineRange(0, 40).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A line the runtime stored once it left the scrollback: its text, whether it continues the line before, and its runs of color and style.
 *
 * @example
 * ```ts
 * import { Resources, TerminalLine, TerminalTextRun } from "@noldova/terminal.protocol";
 *
 * const run = new TerminalTextRun(5, 2, Resources.defaultColor, 0);
 * console.log(new TerminalLine("hello", false, [run]).toJson());
 * ```
 */
export declare class TerminalLine {
  /**
   * The line's text.
   */
  public readonly text: string;

  /**
   * Whether the line continues the line before, which the terminal wrapped; `wrapped` on the wire.
   */
  public readonly isWrapped: boolean;

  /**
   * The line's runs, in order, whose lengths add up to the text's length.
   */
  public readonly runs: readonly TerminalTextRun[];

  /**
   * Creates a line.
   *
   * @param text The line's text: at most {@link Resources.maximumLineLength} UTF-16 code units, and may be empty.
   * @param isWrapped Whether the line continues the line before.
   * @param runs The runs, copied into a new array: their lengths add up to the text's length, so an empty line has none.
   * @throws {@link ArgumentException} Synchronously, when the text is too long or the runs don't cover it exactly.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { Resources, TerminalLine, TerminalTextRun } from "@noldova/terminal.protocol";
   *
   * const empty = new TerminalLine("", false, []);
   * try {
   *   new TerminalLine("hello", false, [new TerminalTextRun(3, Resources.defaultColor, Resources.defaultColor, 0)]);
   * }
   * catch (error) {
   *   console.log(empty.runs.length, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(text: string, isWrapped: boolean, runs: readonly TerminalTextRun[]);

  /**
   * Reads a line from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `text`, `wrapped` and `runs`.
   * @returns The line.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field, or a field of a run, is missing,
   * unknown, of the wrong type or out of its range; the exception's path names the field.
   * @throws {@link JsonException} Synchronously, also when the runs don't cover the text exactly, or a run's color is no color, at the
   * field's path, with the constructor's `ArgumentException` as its cause.
   *
   * @example
   * ```ts
   * import { TerminalLine } from "@noldova/terminal.protocol";
   *
   * const line = TerminalLine.fromJson({ text: "hi", wrapped: false, runs: [{ length: 2, foreground: -1, background: -1, style: 1 }] });
   * console.log(line.runs[0]?.style);
   * ```
   */
  public static fromJson(value: unknown): TerminalLine;

  /**
   * Reads a line from a reader of its wire form, as a message that holds one does.
   *
   * @param reader A reader of the wire form, which {@link TerminalLine.fromJson} describes.
   * @returns The line.
   * @throws {@link JsonException} Synchronously, as {@link TerminalLine.fromJson} does, with paths under the reader's path.
   *
   * @example
   * ```ts
   * import { ProtocolReader, TerminalLine } from "@noldova/terminal.protocol";
   *
   * const reader = ProtocolReader.fromValue({ text: "", wrapped: true, runs: [] });
   * console.log(TerminalLine.fromReader(reader).isWrapped);
   * ```
   */
  public static fromReader(reader: ProtocolReader): TerminalLine;

  /**
   * Gives the line's wire form.
   *
   * @returns A new plain object that {@link TerminalLine.fromJson} reads back to an equal line.
   *
   * @example
   * ```ts
   * import { TerminalLine } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalLine("", false, []).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The window part's request for a page of a terminal's stored lines; the runtime answers with a {@link TerminalLinePage} of the part of
 * them it still keeps.
 *
 * @example
 * ```ts
 * import { TerminalLinesParams, TerminalNames } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.linesMethod, new TerminalLinesParams("session-1", 0, 100).toJson());
 * ```
 */
export declare class TerminalLinesParams {
  /**
   * The terminal's session ID.
   */
  public readonly sessionId: string;

  /**
   * The number of the first line asked for, counted from the terminal's first line.
   */
  public readonly start: number;

  /**
   * The most lines asked for.
   */
  public readonly limit: number;

  /**
   * Creates the request.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param start The first line: an integer from `0` to {@link Resources.maximumOffset}.
   * @param limit The most lines: an integer from `1` to {@link Resources.maximumPageLines}.
   * @throws {@link ArgumentException} Synchronously, when the session ID is blank or too long, or a number isn't an integer in its range.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { Resources, TerminalLinesParams } from "@noldova/terminal.protocol";
   *
   * const request = new TerminalLinesParams("session-1", 0, Resources.maximumPageLines);
   * try {
   *   new TerminalLinesParams("session-1", 0, 0);
   * }
   * catch (error) {
   *   console.log(request.limit, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(sessionId: string, start: number, limit: number);

  /**
   * Reads the request from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `sessionId`, `start` and `limit`.
   * @returns The request.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field is missing, unknown, of the wrong type or
   * breaks the constructor's rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalLinesParams } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalLinesParams.fromJson({ sessionId: "session-1", start: 0, limit: 500 }).limit);
   * ```
   */
  public static fromJson(value: unknown): TerminalLinesParams;

  /**
   * Gives the request's wire form.
   *
   * @returns A new plain object that {@link TerminalLinesParams.fromJson} reads back to an equal request.
   *
   * @example
   * ```ts
   * import { TerminalLinesParams } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalLinesParams("session-1", 200, 100).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The person's name for a terminal: what {@link TerminalNames.renameMethod} takes and {@link TerminalNames.renamedEvent} carries.
 *
 * @example
 * ```ts
 * import { TerminalName, TerminalNames } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.renameMethod, new TerminalName("session-1", "Server").toJson());
 * ```
 */
export declare class TerminalName {
  /**
   * The terminal's session ID.
   */
  public readonly sessionId: string;

  /**
   * The name its tabs show in place of the shell's name, or `null` to go back to the shell's name.
   */
  public readonly name: string | null;

  /**
   * Creates the name.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param name The name: `null`, or not blank and at most {@link Resources.maximumTitleLength} UTF-16 code units.
   * @throws {@link ArgumentException} Synchronously, when the session ID is blank or too long, or the name is blank or too long.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalName } from "@noldova/terminal.protocol";
   *
   * const cleared = new TerminalName("session-1", null);
   * try {
   *   new TerminalName("session-1", " ");
   * }
   * catch (error) {
   *   console.log(cleared.name, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(sessionId: string, name: string | null);

  /**
   * Reads the name from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `sessionId` and `name`, which may be `null`.
   * @returns The name.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field is missing, unknown, of the wrong type or
   * breaks the constructor's rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalName } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalName.fromJson({ sessionId: "session-1", name: "Server" }).name);
   * ```
   */
  public static fromJson(value: unknown): TerminalName;

  /**
   * Gives the name's wire form.
   *
   * @returns A new plain object that {@link TerminalName.fromJson} reads back to an equal name.
   *
   * @example
   * ```ts
   * import { TerminalName } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalName("session-1", null).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The names of the runtime's `terminal.*` methods and events.
 *
 * @example
 * ```ts
 * import { TerminalNames } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.methods.includes(TerminalNames.openMethod), TerminalNames.events.length);
 * ```
 */
export declare class TerminalNames {
  /**
   * `"terminal.shells"`, which answers with the {@link TerminalShells} the person can open.
   */
  public static readonly shellsMethod: string;

  /**
   * `"terminal.open"`, which takes a {@link TerminalOpenParams} and answers with the new terminal's {@link TerminalReference}.
   */
  public static readonly openMethod: string;

  /**
   * `"terminal.close"`, which takes a {@link TerminalReference}, ends the terminal's shell and forgets the terminal.
   */
  public static readonly closeMethod: string;

  /**
   * `"terminal.restart"`, which takes a {@link TerminalRestartParams} and starts the terminal's shell again.
   */
  public static readonly restartMethod: string;

  /**
   * `"terminal.sessions"`, which answers with the {@link TerminalSessions} the runtime runs.
   */
  public static readonly sessionsMethod: string;

  /**
   * `"terminal.attach"`, which takes a {@link TerminalPaneReference} and answers with a {@link TerminalAttachment}.
   */
  public static readonly attachMethod: string;

  /**
   * `"terminal.input"`, which takes a {@link TerminalInputParams}.
   */
  public static readonly inputMethod: string;

  /**
   * `"terminal.resize"`, which takes a {@link TerminalResizeParams}.
   */
  public static readonly resizeMethod: string;

  /**
   * `"terminal.ack"`, which takes a {@link TerminalAckParams}.
   */
  public static readonly ackMethod: string;

  /**
   * `"terminal.visibility"`, which takes a {@link TerminalVisibilityParams}.
   */
  public static readonly visibilityMethod: string;

  /**
   * `"terminal.detach"`, which takes the {@link TerminalPaneReference} of a pane that no longer shows the terminal.
   */
  public static readonly detachMethod: string;

  /**
   * `"terminal.lines"`, which takes a {@link TerminalLinesParams} and answers with a {@link TerminalLinePage}.
   */
  public static readonly linesMethod: string;

  /**
   * `"terminal.restore"`, which takes a {@link TerminalRestoreParams} and opens
   * again, once a run, the person's terminals the last run left open, with
   * their ids; it answers with null.
   */
  public static readonly restoreMethod: string;

  /**
   * `"terminal.output"`, which carries a {@link TerminalOutput}.
   */
  public static readonly outputEvent: string;

  /**
   * `"terminal.exited"`, which carries a {@link TerminalExited}.
   */
  public static readonly exitedEvent: string;

  /**
   * `"terminal.restarted"`, which carries the {@link TerminalReference} of a terminal whose shell started again.
   */
  public static readonly restartedEvent: string;

  /**
   * `"terminal.titleChanged"`, which carries a {@link TerminalTitle}.
   */
  public static readonly titleChangedEvent: string;

  /**
   * `"terminal.cwdChanged"`, which carries a {@link TerminalCwd}.
   */
  public static readonly cwdChangedEvent: string;

  /**
   * `"terminal.detached"`, which carries the {@link TerminalPaneReference} of a pane the runtime detached because it fell too far
   * behind.
   */
  public static readonly detachedEvent: string;

  /**
   * `"terminal.closeOwner"`, which takes a {@link TerminalOwnerReference}, ends the shells of the terminals tied to that owner and forgets
   * them.
   */
  public static readonly closeOwnerMethod: string;

  /**
   * `"terminal.launch"`, which takes a {@link TerminalLaunchParams} and answers with a {@link TerminalLaunched}: an app's terminal, with
   * its own variables and notice, which isn't kept for the next run.
   */
  public static readonly launchMethod: string;

  /**
   * `"terminal.run"`, which takes a {@link TerminalRunParams}, picks the owner's newest free terminal or opens one, or takes the terminal it
   * names, and answers once it has typed the commands or given up with a {@link TerminalRunResult}.
   */
  public static readonly runMethod: string;

  /**
   * `"terminal.runOutput"`, which takes a {@link TerminalRunOutputParams} and answers with the run's {@link TerminalRunOutput}, or with null
   * for a run the runtime can't give; only the app asks it.
   */
  public static readonly runOutputMethod: string;

  /**
   * `"terminal.windowStarted"`, which takes null and ends the terminals the asking window's earlier pages launched without a tab, as before a
   * reload, which no closure reports, but the asking page's own; it waits only for that window's launches under way and answers with null.
   */
  public static readonly windowStartedMethod: string;

  /**
   * `"terminal.showOwner"`, which takes a {@link TerminalShowOwnerParams} naming the owner whose terminals the asking window shows, or none,
   * and whether the window is hidden, and answers with null. A window sends it as it starts and whenever either changes; the runtime keeps it
   * for the window until the window disconnects. A run's shell that no window shows starts at once; one whose owner a reaching window shows
   * starts at the terminal's first fit, or once no reaching window shows that owner any more. A run without a tab starts its shell at the
   * asking window's fit, or at once while that window is hidden or gone, since a hidden window draws no frame to fit it. A run waits up to
   * 10 seconds for either fit, then starts the shell at the size it opened with.
   */
  public static readonly showOwnerMethod: string;

  /**
   * `"terminal.rename"`, which takes a {@link TerminalName} and gives the terminal the person's name for its tabs, or with a `null` name takes
   * it away, so the tabs go back to the shell's name. The runtime keeps the name while the terminal is open, and for the next run when it
   * keeps the terminal, sends {@link TerminalNames.renamedEvent} to every window that reaches the terminal, and answers with null. A terminal
   * the asking connection doesn't reach is refused as missing.
   */
  public static readonly renameMethod: string;

  /**
   * `"terminal.complete"`, which takes a {@link TerminalCompleteParams} and answers with a {@link TerminalCompletion}: what can follow at the
   * cursor of a bash, zsh or PowerShell line, read in the shell's last working folder with the environment a shell the terminal starts now
   * gets. The runtime lists the commands on PATH and the names a bash or zsh prompt reported, or PowerShell's common cmdlets, for a command's first word, git's branches after `git checkout`,
   * `git switch`, `git merge` or `git rebase`, the nearest `package.json`'s scripts after `npm run` or `npm run-script`, and else the files and
   * folders of the word's folder. Any other shell gets no choices. A terminal the asking connection doesn't reach is refused as missing.
   */
  public static readonly completeMethod: string;

  /**
   * `"terminal.findCommands"`, which takes a {@link TerminalFindCommandsParams} and answers with a {@link TerminalMissingCommands}: which of
   * the names typed at a bash or zsh prompt the shell would find nowhere, among its builtins, the aliases, functions, builtins and keywords
   * its last prompt reported, and the commands on its PATH; a name with a folder part, `~` or a leading `.` is a path, never missing. Any other
   * shell, one that hasn't reported its names, or a lookup that runs past its time, gets no names. A terminal the asking connection
   * doesn't reach is refused as missing.
   */
  public static readonly findCommandsMethod: string;

  /**
   * `"terminal.closed"`, which carries the {@link TerminalReference} of a terminal with an owner that closed, by
   * {@link TerminalNames.closeOwnerMethod}, a tab's close or an agent's, so every window closes its tab.
   */
  public static readonly closedEvent: string;

  /**
   * `"terminal.opened"`, which carries the {@link TerminalSummary} of an agent's terminal that opened with an owner, or of a terminal a run
   * opened for its owner, so every window that shows the owner opens its tab.
   */
  public static readonly openedEvent: string;

  /**
   * `"terminal.runOpened"`, which carries the {@link TerminalReference} of the terminal a run without a tab picked or opened, before anything
   * is typed into it, only to the window that asked for the run, so the app can show that terminal in its own pane.
   */
  public static readonly runOpenedEvent: string;

  /**
   * `"terminal.launchCommandEnded"`, which carries the {@link TerminalCommandEnded} of a launched terminal's command, once per launch with a
   * command, to the connection that launched it.
   */
  public static readonly launchCommandEndedEvent: string;

  /**
   * `"terminal.runEnded"`, which carries the {@link TerminalRunEnded} of a run the runtime typed, once per run, only to the window that asked
   * for the run; an end the runtime knew as it typed a run comes in that run's {@link TerminalRunResult} instead.
   */
  public static readonly runEndedEvent: string;

  /**
   * `"terminal.renamed"`, which carries the {@link TerminalName} a {@link TerminalNames.renameMethod} gave a terminal, to every window that
   * reaches the terminal, so each retitles its tab.
   */
  public static readonly renamedEvent: string;

  /**
   * `"terminal.commandAdded"`, which carries a {@link TerminalCommandAdded} to every window that reaches a terminal of the same shell as the
   * one where the person started the command, for each such terminal a person types in.
   */
  public static readonly commandAddedEvent: string;

  /**
   * Every method's name, in the order above.
   */
  public static readonly methods: readonly string[];

  /**
   * Every event's name, in the order above.
   */
  public static readonly events: readonly string[];
}

/**
 * The window part's request that the runtime open a terminal; the runtime answers with its {@link TerminalReference}.
 *
 * @example
 * ```ts
 * import { TerminalNames, TerminalOpenParams, TerminalSize } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.openMethod, new TerminalOpenParams(null, null, new TerminalSize(80, 24)).toJson());
 * ```
 */
export declare class TerminalOpenParams {
  /**
   * The shell to run, one of {@link TerminalShells}' IDs, or `null` for the default shell.
   */
  public readonly shellId: string | null;

  /**
   * The folder the shell starts in, or `null` for the person's home folder. The runtime opens a folder that no longer exists in the home
   * folder too, and says so in the module's log and the terminal's first line.
   */
  public readonly folder: string | null;

  /**
   * The terminal's size.
   */
  public readonly size: TerminalSize;

  /**
   * The most bytes the terminal stores of the lines that leave its scrollback.
   */
  public readonly storedLimit: number;

  /**
   * Whether the terminal is the one a window's terminal panel shows, rather than a tab's. The runtime keeps one panel terminal: a panel
   * open answers with the one it has or is still opening.
   */
  public readonly isPanelTerminal: boolean;

  /**
   * What the terminal is tied to, such as a chat, or `null` for a general terminal. The module only compares owners.
   */
  public readonly owner: string | null;

  /**
   * Creates the request.
   *
   * @param shellId The shell's ID: `null`, or not blank and at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param folder The starting folder: `null`, or an absolute path of at most {@link Resources.maximumPathLength} UTF-16 code units.
   * @param size The terminal's size.
   * @param storedLimit The stored-line limit, in bytes: an integer from {@link Resources.minimumStoredLimit} to
   * {@link Resources.maximumStoredLimit}; {@link Resources.defaultStoredLimit} when left out.
   * @param isPanelTerminal Whether the terminal is the panel's; `false` when left out.
   * @param owner The owner: `null`, or not blank and at most {@link Resources.maximumOwnerLength} UTF-16 code units; `null` when left out.
   * @throws {@link ArgumentException} Synchronously, when the shell ID is blank or too long, the folder is blank, too long or relative, the
   * limit isn't an integer in its range, or the owner is blank, too long or given for a panel terminal.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { Resources, TerminalOpenParams, TerminalSize } from "@noldova/terminal.protocol";
   *
   * const size = new TerminalSize(80, 24);
   * const request = new TerminalOpenParams("bash", "/home/user", size, Resources.minimumStoredLimit);
   * try {
   *   new TerminalOpenParams(null, null, size, Resources.storedLimitUnit);
   * }
   * catch (error) {
   *   console.log(request.storedLimit, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(shellId: string | null, folder: string | null, size: TerminalSize, storedLimit?: number, isPanelTerminal?: boolean,
    owner?: string | null);

  /**
   * Reads the request from its wire form.
   *
   * @param value The wire form, untrusted: an object with the fields `shellId` and `folder`, which may be `null`, `size` and
   * `storedLimit`, each required, `isPanelTerminal`, `false` when absent, and `owner`, `null` when absent; no others.
   * @returns The request.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field, or a field of `size`, is missing,
   * unknown, of the wrong type or breaks the constructor's rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalOpenParams } from "@noldova/terminal.protocol";
   *
   * const request = TerminalOpenParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104857600 });
   * console.log(request.size.columns);
   * ```
   */
  public static fromJson(value: unknown): TerminalOpenParams;

  /**
   * Gives the request's wire form.
   *
   * @returns A new plain object that {@link TerminalOpenParams.fromJson} reads back to an equal request.
   *
   * @example
   * ```ts
   * import { TerminalOpenParams, TerminalSize } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalOpenParams(null, "/tmp", new TerminalSize(120, 40)).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime's event that carries a batch of a terminal's output.
 *
 * @remarks
 * Batches are numbered by their offset, so a pane drops what it already drew and attaches again when output skips ahead.
 * The stored range is the terminal's as the output left the runtime, so a pane knows how many lines it can page in.
 *
 * @example
 * ```ts
 * import { TerminalLineRange, TerminalNames, TerminalOutput } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.outputEvent, new TerminalOutput("session-1", 0, "$ ", new TerminalLineRange(0, 0)).toJson());
 * ```
 */
export declare class TerminalOutput {
  /**
   * The terminal's session ID.
   */
  public readonly sessionId: string;

  /**
   * The output offset of the batch's first UTF-16 code unit.
   */
  public readonly offset: number;

  /**
   * The output, as the shell wrote it.
   */
  public readonly data: string;

  /**
   * The terminal's stored lines as the batch left the runtime.
   */
  public readonly stored: TerminalLineRange;

  /**
   * Where the shell's line for the person's command starts or ends within the batch, in order; empty for an agent's terminal and a shell
   * without the integration.
   */
  public readonly inputs: readonly TerminalInputMark[];

  /**
   * Creates a batch.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param offset The batch's offset: an integer from `0` to {@link Resources.maximumOffset}.
   * @param data The output: at most {@link Resources.maximumOutputLength} UTF-16 code units, and may be empty.
   * @param stored The stored lines as the batch leaves the runtime.
   * @param inputs The line's edges, in order, each from the batch's offset to its end offset; empty by default.
   * @throws {@link ArgumentException} Synchronously, when the session ID is blank or too long, the offset isn't an integer in its range,
   * the output is too long, or an edge lies outside the batch or out of order.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalLineRange, TerminalOutput } from "@noldova/terminal.protocol";
   *
   * const stored = new TerminalLineRange(0, 0);
   * const output = new TerminalOutput("session-1", 0, "", stored);
   * try {
   *   new TerminalOutput("session-1", -1, "$ ", stored);
   * }
   * catch (error) {
   *   console.log(output.endOffset, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(sessionId: string, offset: number, data: string, stored: TerminalLineRange, inputs?: readonly TerminalInputMark[]);

  /**
   * The output offset just after the batch, the offset plus the output's length, which a pane acknowledges once it drew the batch.
   */
  public get endOffset(): number;

  /**
   * Reads a batch from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `sessionId`, `offset`, `data`, `stored` and `inputs`.
   * @returns The batch.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field, or a field of `stored` or of an input, is
   * missing, unknown, of the wrong type or out of its range; the exception's path names the field.
   * @throws {@link JsonException} Synchronously, also when `stored` breaks {@link TerminalLineRange}'s rules, or an input lies outside the
   * batch or out of order, at the field's path, with the constructor's `ArgumentException` as its cause.
   *
   * @example
   * ```ts
   * import { TerminalOutput } from "@noldova/terminal.protocol";
   *
   * const output = TerminalOutput.fromJson({ sessionId: "session-1", offset: 100, data: "ok", stored: { start: 0, end: 0, dropped: 0 },
   *   inputs: [{ offset: 102, edge: "Start" }] });
   * console.log(output.endOffset);
   * ```
   */
  public static fromJson(value: unknown): TerminalOutput;

  /**
   * Gives the batch's wire form.
   *
   * @returns A new plain object that {@link TerminalOutput.fromJson} reads back to an equal batch.
   *
   * @example
   * ```ts
   * import { TerminalLineRange, TerminalOutput } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalOutput("session-1", 2, "ls\r\n", new TerminalLineRange(0, 0)).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * What an app ties terminals to, such as a chat: a string it chooses, which the module only compares.
 *
 * @example
 * ```ts
 * import { TerminalNames, TerminalOwnerReference } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.closeOwnerMethod, new TerminalOwnerReference("example.chat/42").toJson());
 * ```
 */
export declare class TerminalOwnerReference {
  /**
   * The owner.
   */
  public readonly owner: string;

  /**
   * Creates an owner reference.
   *
   * @param owner The owner: not blank, at most {@link Resources.maximumOwnerLength} UTF-16 code units.
   * @throws {@link ArgumentException} Synchronously, when the owner is blank or too long.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalOwnerReference } from "@noldova/terminal.protocol";
   *
   * try {
   *   new TerminalOwnerReference(" ");
   * }
   * catch (error) {
   *   console.log(error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(owner: string);

  /**
   * Reads an owner reference from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the field `owner`.
   * @returns The owner reference.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or the field is missing, unknown, of the wrong type or
   * breaks the constructor's rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalOwnerReference } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalOwnerReference.fromJson({ owner: "example.chat/42" }).owner);
   * ```
   */
  public static fromJson(value: unknown): TerminalOwnerReference;

  /**
   * Gives the owner reference's wire form.
   *
   * @returns A new plain object that {@link TerminalOwnerReference.fromJson} reads back to an equal reference.
   *
   * @example
   * ```ts
   * import { TerminalOwnerReference } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalOwnerReference("example.chat/42").toJson());
   * ```
   */
  public toJson(): JsonObject;
}


/**
 * One pane of a terminal: the message of `terminal.attach` and `terminal.detach`, and of the event that the runtime detached a pane.
 *
 * @example
 * ```ts
 * import { TerminalNames, TerminalPaneReference } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.attachMethod, new TerminalPaneReference("session-1", "pane-1").toJson());
 * ```
 */
export declare class TerminalPaneReference {
  /**
   * The terminal's session ID.
   */
  public readonly sessionId: string;

  /**
   * The pane's ID, which the window part chooses.
   */
  public readonly paneId: string;

  /**
   * Creates a pane reference.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param paneId The pane's ID, with the same rules as the session ID.
   * @throws {@link ArgumentException} Synchronously, when an ID is blank or too long.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalPaneReference } from "@noldova/terminal.protocol";
   *
   * const pane = new TerminalPaneReference("session-1", "pane-1");
   * try {
   *   new TerminalPaneReference("session-1", "");
   * }
   * catch (error) {
   *   console.log(pane.paneId, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(sessionId: string, paneId: string);

  /**
   * Reads a pane reference from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `sessionId` and `paneId`.
   * @returns The pane reference.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field is missing, unknown, of the wrong type or
   * breaks the constructor's rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalPaneReference } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalPaneReference.fromJson({ sessionId: "session-1", paneId: "pane-1" }).paneId);
   * ```
   */
  public static fromJson(value: unknown): TerminalPaneReference;

  /**
   * Gives the pane reference's wire form.
   *
   * @returns A new plain object that {@link TerminalPaneReference.fromJson} reads back to an equal pane reference.
   *
   * @example
   * ```ts
   * import { TerminalPaneReference } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalPaneReference("session-1", "pane-2").toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One terminal: the answer of `terminal.open`, the message of `terminal.close`, and the event that a terminal's shell restarted.
 *
 * @example
 * ```ts
 * import { TerminalNames, TerminalReference } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.closeMethod, new TerminalReference("session-1").toJson());
 * ```
 */
export declare class TerminalReference {
  /**
   * The terminal's session ID, which the runtime chooses when it opens the terminal.
   */
  public readonly sessionId: string;

  /**
   * Creates a terminal reference.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @throws {@link ArgumentException} Synchronously, when the session ID is blank or too long.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalReference } from "@noldova/terminal.protocol";
   *
   * const terminal = new TerminalReference("session-1");
   * try {
   *   new TerminalReference("x".repeat(201));
   * }
   * catch (error) {
   *   console.log(terminal.sessionId, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(sessionId: string);

  /**
   * Reads a terminal reference from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the field `sessionId`.
   * @returns The terminal reference.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or the field is missing, of the wrong type or breaks
   * the constructor's rules, or another field is present; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalReference } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalReference.fromJson({ sessionId: "session-1" }).sessionId);
   * ```
   */
  public static fromJson(value: unknown): TerminalReference;

  /**
   * Gives the terminal reference's wire form.
   *
   * @returns A new plain object that {@link TerminalReference.fromJson} reads back to an equal terminal reference.
   *
   * @example
   * ```ts
   * import { TerminalReference } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalReference("session-1").toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The window part's request that the runtime resize a terminal.
 *
 * @example
 * ```ts
 * import { TerminalNames, TerminalResizeParams, TerminalSize } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.resizeMethod, new TerminalResizeParams("session-1", new TerminalSize(120, 40)).toJson());
 * ```
 */
export declare class TerminalResizeParams {
  /**
   * The terminal's session ID.
   */
  public readonly sessionId: string;

  /**
   * The terminal's new size.
   */
  public readonly size: TerminalSize;

  /**
   * Creates the request.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param size The new size.
   * @throws {@link ArgumentException} Synchronously, when the session ID is blank or too long.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalResizeParams, TerminalSize } from "@noldova/terminal.protocol";
   *
   * const request = new TerminalResizeParams("session-1", new TerminalSize(1, 1));
   * try {
   *   new TerminalResizeParams(" ", new TerminalSize(80, 24));
   * }
   * catch (error) {
   *   console.log(request.size.rows, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(sessionId: string, size: TerminalSize);

  /**
   * Reads the request from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `sessionId` and `size`.
   * @returns The request.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field, or a field of `size`, is missing,
   * unknown, of the wrong type or breaks its rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalResizeParams } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalResizeParams.fromJson({ sessionId: "session-1", size: { cols: 120, rows: 40 } }).size.columns);
   * ```
   */
  public static fromJson(value: unknown): TerminalResizeParams;

  /**
   * Gives the request's wire form.
   *
   * @returns A new plain object that {@link TerminalResizeParams.fromJson} reads back to an equal request.
   *
   * @example
   * ```ts
   * import { TerminalResizeParams, TerminalSize } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalResizeParams("session-1", new TerminalSize(80, 24)).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The window part's request that the runtime start a terminal's shell again, in the same terminal and folder.
 *
 * @remarks
 * A running shell ends first.
 * The new shell starts at the size of the pane that asks, so the old screen scrolls up by that pane's rows and stays above the new shell.
 *
 * @example
 * ```ts
 * import { TerminalNames, TerminalRestartParams, TerminalSize } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.restartMethod, new TerminalRestartParams("session-1", new TerminalSize(80, 24)).toJson());
 * ```
 */
export declare class TerminalRestartParams {
  /**
   * The terminal's session ID.
   */
  public readonly sessionId: string;

  /**
   * The size of the pane that asks, which the new shell starts at.
   */
  public readonly size: TerminalSize;

  /**
   * Creates the request.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param size The asking pane's size.
   * @throws {@link ArgumentException} Synchronously, when the session ID is blank or too long.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalRestartParams, TerminalSize } from "@noldova/terminal.protocol";
   *
   * const size = new TerminalSize(80, 24);
   * const request = new TerminalRestartParams("session-1", size);
   * try {
   *   new TerminalRestartParams("", size);
   * }
   * catch (error) {
   *   console.log(request.sessionId, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(sessionId: string, size: TerminalSize);

  /**
   * Reads the request from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `sessionId` and `size`.
   * @returns The request.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field, or a field of `size`, is missing,
   * unknown, of the wrong type or breaks its rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalRestartParams } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalRestartParams.fromJson({ sessionId: "session-1", size: { cols: 80, rows: 24 } }).size.rows);
   * ```
   */
  public static fromJson(value: unknown): TerminalRestartParams;

  /**
   * Gives the request's wire form.
   *
   * @returns A new plain object that {@link TerminalRestartParams.fromJson} reads back to an equal request.
   *
   * @example
   * ```ts
   * import { TerminalRestartParams, TerminalSize } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalRestartParams("session-1", new TerminalSize(80, 24)).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The window part's request that the runtime open again the person's terminals the last run left open.
 *
 * @remarks
 * The terminals open at the given size, which each pane fits once it attaches, and keep the output a new terminal would.
 * A terminal whose shell is gone starts the window's default shell while the runtime finds it, else the runtime's default.
 *
 * @example
 * ```ts
 * import { TerminalNames, TerminalRestoreParams, TerminalSize } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.restoreMethod, new TerminalRestoreParams(new TerminalSize(80, 24), "zsh").toJson());
 * ```
 */
export declare class TerminalRestoreParams {
  /**
   * The size the terminals open at.
   */
  public readonly size: TerminalSize;

  /**
   * The shell a terminal whose shell is gone starts, the window's default, or `null` for the runtime's default.
   */
  public readonly shellId: string | null;

  /**
   * The most bytes of the lines that leave a terminal's scrollback that the terminal stores.
   */
  public readonly storedLimit: number;

  /**
   * Creates the request.
   *
   * @param size The size the terminals open at.
   * @param shellId The shell a terminal whose shell is gone starts: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code
   * units; `null`, the default, leaves it to the runtime's default shell.
   * @param storedLimit The bytes each terminal stores, from {@link Resources.minimumStoredLimit} to {@link Resources.maximumStoredLimit};
   * {@link Resources.defaultStoredLimit} by default.
   * @throws {@link ArgumentException} Synchronously, when the shell ID is blank or too long, or the limit isn't a whole number in its bounds.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalRestoreParams, TerminalSize } from "@noldova/terminal.protocol";
   *
   * const size = new TerminalSize(80, 24);
   * const request = new TerminalRestoreParams(size, "zsh", 52_428_800);
   * try {
   *   new TerminalRestoreParams(size, null, 1);
   * }
   * catch (error) {
   *   console.log(request.storedLimit, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(size: TerminalSize, shellId?: string | null, storedLimit?: number);

  /**
   * Reads the request from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `size`, `shellId` and `storedLimit`.
   * @returns The request.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field, or a field of `size`, is missing,
   * unknown, of the wrong type or breaks its rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalRestoreParams } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalRestoreParams.fromJson({ size: { cols: 80, rows: 24 }, shellId: null, storedLimit: 104_857_600 }).size.rows);
   * ```
   */
  public static fromJson(value: unknown): TerminalRestoreParams;

  /**
   * Gives the request's wire form.
   *
   * @returns A new plain object that {@link TerminalRestoreParams.fromJson} reads back to an equal request.
   *
   * @example
   * ```ts
   * import { TerminalRestoreParams, TerminalSize } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalRestoreParams(new TerminalSize(80, 24)).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The app's request for a typed run's output, its last lines up to a limit; the runtime answers with a {@link TerminalRunOutput}, or with
 * null for a run it can't give.
 *
 * @remarks
 * The answer holds the run's lines from the prompt where its commands were typed up to the prompt where the next run into the same terminal
 * typed, or up to the cursor's line for the terminal's latest run, so the person's own commands in between are included. Only the app reads
 * it, and only from a person's terminal; no agent tool does. The answer is null, alike for each case, for a run the terminal never had or no
 * longer keeps, as it keeps its latest 100 runs, one whose shell ended or restarted, one whose terminal the runtime no longer has, such as
 * after the runtime started again, or when the caller isn't the app, doesn't reach the terminal or the terminal isn't a person's.
 *
 * @example
 * ```ts
 * import { TerminalNames, TerminalRunOutputParams } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.runOutputMethod, new TerminalRunOutputParams("session-1", "run-1", 2000).toJson());
 * ```
 */
export declare class TerminalRunOutputParams {
  /**
   * The session ID of the terminal the run typed into.
   */
  public readonly sessionId: string;

  /**
   * The run's ID, from its {@link TerminalRunResult}.
   */
  public readonly runId: string;

  /**
   * The most lines asked for, the run's last ones.
   */
  public readonly maximumLines: number;

  /**
   * Creates the request.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param runId The run's ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param maximumLines The most lines: an integer from `1` to {@link Resources.maximumRunLines}.
   * @throws {@link ArgumentException} Synchronously, when an ID is blank or too long, or the most lines isn't an integer in its range.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { Resources, TerminalRunOutputParams } from "@noldova/terminal.protocol";
   *
   * const request = new TerminalRunOutputParams("session-1", "run-1", Resources.maximumRunLines);
   * try {
   *   new TerminalRunOutputParams("session-1", "run-1", 0);
   * }
   * catch (error) {
   *   console.log(request.maximumLines, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(sessionId: string, runId: string, maximumLines: number);

  /**
   * Reads the request from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `sessionId`, `runId` and `maximumLines`.
   * @returns The request.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field is missing, unknown, of the wrong type, blank,
   * too long or out of its range; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalRunOutputParams } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalRunOutputParams.fromJson({ sessionId: "session-1", runId: "run-1", maximumLines: 500 }).runId);
   * ```
   */
  public static fromJson(value: unknown): TerminalRunOutputParams;

  /**
   * Gives the request's wire form.
   *
   * @returns A new plain object that {@link TerminalRunOutputParams.fromJson} reads back to an equal request.
   *
   * @example
   * ```ts
   * import { TerminalRunOutputParams } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalRunOutputParams("session-1", "run-1", 100).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime's answer to a {@link TerminalRunOutputParams}: a run's output with its colors, its last lines up to the limit asked, with how
 * many earlier lines were cut.
 *
 * @remarks
 * The lines run from the prompt where the run's commands were typed up to, but not including, the prompt where the next run into the same
 * terminal typed, or up to and including the cursor's line for the terminal's latest run. Of those, the answer holds the last ones up to the
 * limit, each from a line's start, so it never begins with the rest of a wrapped line. {@link TerminalRunOutput.cutLines} counts the run's
 * earlier lines the answer leaves out: those over the limit, the rest of a wrapped line before the first, and those the terminal's screen and
 * scrollback no longer hold, such as lines that moved on to its stored lines or ones the shell erased, as `clear` does.
 *
 * @example
 * ```ts
 * import { Resources, TerminalLine, TerminalRunOutput, TerminalTextRun } from "@noldova/terminal.protocol";
 *
 * const line = new TerminalLine("ok", false, [new TerminalTextRun(2, Resources.defaultColor, Resources.defaultColor, 0)]);
 * console.log(new TerminalRunOutput([line], 0).toJson());
 * ```
 */
export declare class TerminalRunOutput {
  /**
   * The run's last lines, in order; empty when the terminal holds none of them.
   */
  public readonly lines: readonly TerminalLine[];

  /**
   * How many of the run's lines before {@link TerminalRunOutput.lines} were cut, by the limit asked or because the terminal no longer holds
   * them.
   */
  public readonly cutLines: number;

  /**
   * Creates the answer.
   *
   * @param lines The lines, copied into a new array: at most {@link Resources.maximumRunLines}.
   * @param cutLines The lines cut before them: an integer from `0` to {@link Resources.maximumOffset}.
   * @throws {@link ArgumentException} Synchronously, when there are too many lines, or the count of cut lines isn't an integer in its range.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalRunOutput } from "@noldova/terminal.protocol";
   *
   * const output = new TerminalRunOutput([], 12);
   * try {
   *   new TerminalRunOutput([], -1);
   * }
   * catch (error) {
   *   console.log(output.cutLines, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(lines: readonly TerminalLine[], cutLines: number);

  /**
   * Reads the answer from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `lines`, an array of {@link TerminalLine}'s wire forms, and
   * `cutLines`.
   * @returns The answer.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field, or a field of a line or a run, is missing,
   * unknown, of the wrong type or out of its range; the exception's path names the field.
   * @throws {@link JsonException} Synchronously, at `lines` before it reads any line, when there are more than
   * {@link Resources.maximumRunLines} lines; and when a line's runs don't cover its text, or a run's color is no color, at the field's path,
   * with the constructor's `ArgumentException` as its cause.
   *
   * @example
   * ```ts
   * import { TerminalRunOutput } from "@noldova/terminal.protocol";
   *
   * const output = TerminalRunOutput.fromJson({ lines: [{ text: "", wrapped: false, runs: [] }], cutLines: 0 });
   * console.log(output.lines.length);
   * ```
   */
  public static fromJson(value: unknown): TerminalRunOutput;

  /**
   * Gives the answer's wire form.
   *
   * @returns A new plain object that {@link TerminalRunOutput.fromJson} reads back to an equal answer.
   *
   * @example
   * ```ts
   * import { TerminalRunOutput } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalRunOutput([], 0).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The end of a run the runtime typed, which it sends in a `terminal.runEnded` event to the window that asked for the run, or in a later
 * {@link TerminalRunResult}: how the run's commands ended, and the last command's exit code when the shell marked one. A run of several lines
 * ends with its last line's command.
 *
 * @example
 * ```ts
 * import { TerminalNames, TerminalRunEnded, TerminalRunEndedBy } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.runEndedEvent, new TerminalRunEnded("session-1", "run-1", TerminalRunEndedBy.Command, 0).toJson());
 * ```
 */
export declare class TerminalRunEnded {
  /**
   * The terminal's session ID.
   */
  public readonly sessionId: string;

  /**
   * The run's ID, as its {@link TerminalRunResult} gave it.
   */
  public readonly runId: string;

  /**
   * How the run's commands ended.
   */
  public readonly endedBy: TerminalRunEndedBy;

  /**
   * The last command's exit code, from {@link Resources.minimumExitCode} to {@link Resources.maximumExitCode}, or `null` when the run didn't
   * end by {@link TerminalRunEndedBy.Command}, or the shell marked the end without a code, as bash does for a subshell such as `(exit 3)`.
   */
  public readonly exitCode: number | null;

  /**
   * Creates the end.
   *
   * @param sessionId The session's ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param runId The run's ID, by the same rule.
   * @param endedBy How the run's commands ended.
   * @param exitCode The last command's exit code, an integer in its range, given only with {@link TerminalRunEndedBy.Command}, or `null`.
   * @throws {@link ArgumentException} Synchronously, when an ID or the exit code breaks its rule, or a code is given with another end.
   *
   * @example
   * ```ts
   * import { TerminalRunEnded, TerminalRunEndedBy } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalRunEnded("session-1", "run-1", TerminalRunEndedBy.TerminalEnded, null).endedBy);
   * ```
   */
  public constructor(sessionId: string, runId: string, endedBy: TerminalRunEndedBy, exitCode: number | null);

  /**
   * Reads the end from its wire form.
   *
   * @param value The wire form, untrusted: an object with the fields `sessionId`, `runId`, `endedBy` and `exitCode`, which may be `null`,
   * each required; no others.
   * @returns The end.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field is missing, unknown, of the wrong type, blank,
   * too long or out of range, or the end isn't one of {@link TerminalRunEndedBy}'s; the exception's path names the field.
   * @throws {@link JsonException} Synchronously, also when the fields break the constructor's rules, at the field's path, with the
   * constructor's `ArgumentException` as its cause.
   *
   * @example
   * ```ts
   * import { TerminalRunEnded } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalRunEnded.fromJson({ sessionId: "session-1", runId: "run-1", endedBy: "Command", exitCode: 1 }).exitCode);
   * ```
   */
  public static fromJson(value: unknown): TerminalRunEnded;

  /**
   * Reads an end from a reader of its wire form, as a message that holds one does.
   *
   * @param reader A reader of the wire form, which {@link TerminalRunEnded.fromJson} describes.
   * @returns The end.
   * @throws {@link JsonException} Synchronously, as {@link TerminalRunEnded.fromJson} does, with paths under the reader's path.
   *
   * @example
   * ```ts
   * import { ProtocolReader, TerminalRunEnded } from "@noldova/terminal.protocol";
   *
   * const reader = ProtocolReader.fromValue({ sessionId: "session-1", runId: "run-1", endedBy: "TerminalEnded", exitCode: null });
   * console.log(TerminalRunEnded.fromReader(reader).endedBy);
   * ```
   */
  public static fromReader(reader: ProtocolReader): TerminalRunEnded;

  /**
   * Gives the end's wire form.
   *
   * @returns A new plain object that {@link TerminalRunEnded.fromJson} reads back to an equal end.
   *
   * @example
   * ```ts
   * import { TerminalRunEnded, TerminalRunEndedBy } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalRunEnded("session-1", "run-1", TerminalRunEndedBy.NoIntegration, null).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime's answer to `terminal.run`: the terminal it picked or opened, and what became of the commands, or no terminal with
 * {@link TerminalRunOutcome.NoShell} when no shell of the run's kinds is installed; a run it typed has an ID, which asks for its output. The
 * answer carries the outcome because a request's own failure reaches the window without its reason. A typed run's answer also carries the run
 * ends the runtime knew as it typed it, since a `terminal.runEnded` event may reach the window after the answer: the end of the run before it
 * in that terminal, which the runtime ends before it types the next, and the run's own end, when its shell has no integration to mark it.
 *
 * @example
 * ```ts
 * import { TerminalRunOutcome, TerminalRunResult } from "@noldova/terminal.protocol";
 *
 * const result = TerminalRunResult.fromJson({ sessionId: "session-1", outcome: "Input", runId: null, endedRuns: [] });
 * console.log(result.outcome === TerminalRunOutcome.Typed);
 * ```
 */
export declare class TerminalRunResult {
  /**
   * The terminal's session, or `null` with {@link TerminalRunOutcome.NoShell}, when no terminal opened.
   */
  public readonly sessionId: string | null;

  /**
   * What became of the commands.
   */
  public readonly outcome: TerminalRunOutcome;

  /**
   * The run's ID, which a {@link TerminalRunOutputParams} gives to ask for its output, or `null` when the outcome isn't
   * {@link TerminalRunOutcome.Typed}.
   */
  public readonly runId: string | null;

  /**
   * The runs into the terminal that ended as the runtime typed this one: the run before it, when the runtime hadn't ended it yet, then this
   * run itself, with {@link TerminalRunEndedBy.NoIntegration}, when its shell has no integration. Empty unless the outcome is
   * {@link TerminalRunOutcome.Typed}.
   */
  public readonly endedRuns: readonly TerminalRunEnded[];

  /**
   * Creates the answer.
   *
   * @param sessionId The session's ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units; `null` exactly when
   * the outcome is {@link TerminalRunOutcome.NoShell}.
   * @param outcome What became of the commands.
   * @param runId The run's ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units; given exactly when the
   * outcome is {@link TerminalRunOutcome.Typed}, and `null` when left out.
   * @param endedRuns The runs that ended as the runtime typed this one, given only with `Typed`; empty when left out.
   * @throws {@link ArgumentException} Synchronously, when the session's ID breaks its rule, or is `null` with another outcome or given with
   * `NoShell`, or the run's ID breaks its rule, or is `null` with `Typed` or given with another outcome, or ended runs are given with another
   * outcome than `Typed`.
   *
   * @example
   * ```ts
   * import { TerminalRunOutcome, TerminalRunResult } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalRunResult("session-1", TerminalRunOutcome.Ended).sessionId);
   * ```
   */
  public constructor(sessionId: string | null, outcome: TerminalRunOutcome, runId?: string | null, endedRuns?: readonly TerminalRunEnded[]);

  /**
   * Reads the answer from its wire form.
   *
   * @param value The wire form, untrusted: an object with the fields `sessionId` and `runId`, which may be `null`, `outcome`, and
   * `endedRuns`, an array of {@link TerminalRunEnded}'s wire forms, each required; no others.
   * @returns The answer.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field is missing, unknown, of the wrong type, blank
   * or too long, or the outcome isn't one of {@link TerminalRunOutcome}'s; the exception's path names the field.
   * @throws {@link JsonException} Synchronously, also when the fields break the constructor's rules, at the field's path, with the
   * constructor's `ArgumentException` as its cause.
   *
   * @example
   * ```ts
   * import { TerminalRunResult } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalRunResult.fromJson({ sessionId: "session-1", outcome: "Tab", runId: null, endedRuns: [] }).outcome);
   * ```
   */
  public static fromJson(value: unknown): TerminalRunResult;

  /**
   * Gives the answer's wire form.
   *
   * @returns A new plain object that {@link TerminalRunResult.fromJson} reads back to an equal answer.
   *
   * @example
   * ```ts
   * import { TerminalRunOutcome, TerminalRunResult } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalRunResult("session-1", TerminalRunOutcome.Typed, "run-1").toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * An app's request that the runtime run commands in a terminal of its owner, such as a chat's code block the person runs; the runtime answers
 * with a {@link TerminalRunResult} that names the terminal it typed them into.
 *
 * @remarks
 * The runtime types them into the owner's newest terminal, reached by the asking connection, that isn't an agent's, runs a shell of one of the
 * kinds, has the shell integration, and is at its prompt with nothing typed after it, no command running and no keys typed within the last
 * second. A run's end comes before the shell draws its next prompt, so when the owner's newest such terminal is still drawing its prompt, from a
 * command's end or a prompt's start until the prompt's end, the runtime waits up to 10 seconds for it, holding it as a run that is starting,
 * and takes it once it is free; the wait ends when the terminal closes, and a terminal still not free after it is passed over.
 * While the owner's terminals or the connection's are closing, a run that names none types nothing and answers
 * {@link TerminalRunOutcome.Ended} naming the newest of them; when the owner has none yet, as while its only terminal is still opening, the
 * run waits for the close to end and then runs as usual, in a new terminal. A shell without
 * the integration, such as Command Prompt, can't be told free, so it never takes them. With none such, it opens a
 * terminal for the owner in the folder, with the default shell when it is of the kinds or none are given, else the first installed shell of the
 * kinds, and types them once the shell is ready, as a launch's command; with no shell of the kinds installed, it opens nothing and answers
 * {@link TerminalRunOutcome.NoShell}. They go in as a paste would type them: their line breaks become carriage returns, inside the bracketed
 * paste marks when the shell asked for them, and an Enter follows; blank lines at their start and line breaks at their end are dropped, so
 * the first command stays on the prompt's line. Their typing counts as the person's keys, so a second run within the second opens another
 * terminal, and a terminal another run is still starting in is passed over. The runtime never logs them.
 *
 * With a session ID, the commands go only into that terminal, which must be a person's terminal of the owner, of one of the kinds, that the
 * asking connection reaches; for any other the run types nothing and answers {@link TerminalRunOutcome.Ended} alike, as for a terminal that
 * closed, so a connection learns nothing of another's terminals. A terminal still drawing its prompt is waited for first, up to 10 seconds,
 * held as a run that is starting, and the wait ends when the terminal closes. A target whose owner's terminals or connection's are closing
 * answers {@link TerminalRunOutcome.Ended} at once and types nothing. While its shell is then busy, running a command or with text on its prompt line, or always for a shell without the
 * integration, which can't be told free, a {@link TerminalRunBusy.Refuse} run types nothing and answers {@link TerminalRunOutcome.Busy}; a
 * {@link TerminalRunBusy.Interrupt} run sends Ctrl+C, waits up to 2 seconds for the shell to be free, then types, else answers `Busy`. A run
 * that comes while another run into that terminal is still starting types nothing and answers `Busy`.
 *
 * @example
 * ```ts
 * import { TerminalNames, TerminalRunParams, TerminalShellKind, TerminalSize } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.runMethod, new TerminalRunParams("example.chat/42", "npm test", "/work", [TerminalShellKind.Bash, TerminalShellKind.Zsh], null,
 *   new TerminalSize(80, 24)).toJson());
 * ```
 */
export declare class TerminalRunParams {
  /**
   * The owner whose terminal runs the commands.
   */
  public readonly owner: string;

  /**
   * The commands, one line or several.
   */
  public readonly command: string;

  /**
   * The folder a new terminal starts in, or `null` for the person's home folder, which also stands in for a folder that no longer exists.
   */
  public readonly folder: string | null;

  /**
   * The kinds of shell that may run the commands, or none for any.
   */
  public readonly shellKinds: readonly TerminalShellKind[];

  /**
   * The default shell when no shell of the kinds is installed, one of {@link TerminalShells}' IDs, such as the window's Default shell setting's;
   * `null`, or a shell the runtime no longer finds, for the runtime's default.
   */
  public readonly shellId: string | null;

  /**
   * A new terminal's size.
   */
  public readonly size: TerminalSize;

  /**
   * The most bytes a new terminal stores of the lines that leave its scrollback.
   */
  public readonly storedLimit: number;

  /**
   * The session ID of the only terminal the commands may go into, or `null` to pick the owner's newest free terminal or open one.
   */
  public readonly sessionId: string | null;

  /**
   * What a run with a session ID does when that terminal's shell is busy; a run without one never takes a busy terminal.
   */
  public readonly whenBusy: TerminalRunBusy;

  /**
   * Whether a window's tab opens for the run's terminal: with `false`, none opens or takes the focus, now or when its owner shows, and the
   * runtime tells the asking window which terminal the run picked or opened before it types, by {@link TerminalNames.runOpenedEvent}.
   */
  public readonly opensTab: boolean;

  /**
   * Creates the request.
   *
   * @param owner The owner: not blank, at most {@link Resources.maximumOwnerLength} UTF-16 code units.
   * @param command The commands, as {@link ArgumentValidator.requireScript} checks them.
   * @param folder The starting folder: `null`, or an absolute path of at most {@link Resources.maximumPathLength} UTF-16 code units.
   * @param shellKinds The kinds, each a {@link TerminalShellKind}; the request keeps its own copy.
   * @param shellId The default shell's ID: `null`, or not blank and at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param size A new terminal's size.
   * @param storedLimit The stored-line limit, in bytes: an integer from {@link Resources.minimumStoredLimit} to
   * {@link Resources.maximumStoredLimit}; {@link Resources.defaultStoredLimit} when left out.
   * @param sessionId The given terminal's session ID: `null`, or not blank and at most {@link Resources.maximumIdentifierLength} UTF-16 code
   * units; `null` when left out.
   * @param whenBusy What a busy given terminal gets, a {@link TerminalRunBusy}; {@link TerminalRunBusy.Refuse} when left out.
   * @param opensTab Whether a tab opens for the run's terminal; `true` when left out.
   * @throws {@link ArgumentException} Synchronously, when the owner is blank or too long, the commands are refused, the folder is blank, too
   * long or relative, a kind isn't a {@link TerminalShellKind}, the shell ID or session ID is blank or too long, the limit isn't an integer in
   * its range, or `whenBusy` isn't a {@link TerminalRunBusy}; a refusal never carries the commands.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalRunParams, TerminalSize } from "@noldova/terminal.protocol";
   *
   * try {
   *   new TerminalRunParams("example.chat/42", "echo \u001b[31m", null, [], null, new TerminalSize(80, 24));
   * }
   * catch (error) {
   *   console.log(error instanceof ArgumentException && error.parameterName);
   * }
   * ```
   */
  public constructor(owner: string, command: string, folder: string | null, shellKinds: readonly TerminalShellKind[], shellId: string | null,
    size: TerminalSize, storedLimit?: number, sessionId?: string | null, whenBusy?: TerminalRunBusy, opensTab?: boolean);

  /**
   * Reads the request from its wire form.
   *
   * @param value The wire form, untrusted: an object with the fields `owner`, `command`, `folder`, `shellId` and `sessionId`, of which
   * `folder`, `shellId` and `sessionId` may be `null`, `shellKinds`, an array of {@link TerminalShellKind} values, `size`, `storedLimit` and
   * `whenBusy`, a {@link TerminalRunBusy} value, and `opensTab`, a boolean, each required; no others.
   * @returns The request.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field, a kind or a field of `size` is missing,
   * unknown, of the wrong type or too long, or `whenBusy` isn't one of {@link TerminalRunBusy}'s.
   * @throws {@link JsonException} Synchronously, also when the fields break the constructor's rules, at the field's path, with the
   * constructor's `ArgumentException` as its cause.
   *
   * @example
   * ```ts
   * import { TerminalRunParams } from "@noldova/terminal.protocol";
   *
   * const request = TerminalRunParams.fromJson({ owner: "example.chat/42", command: "npm test", folder: null, shellKinds: ["PowerShell"],
   *   shellId: null, size: { cols: 80, rows: 24 }, storedLimit: 104857600, sessionId: null, whenBusy: "Refuse", opensTab: true });
   * console.log(request.shellKinds);
   * ```
   */
  public static fromJson(value: unknown): TerminalRunParams;

  /**
   * Gives the request's wire form.
   *
   * @returns A new plain object that {@link TerminalRunParams.fromJson} reads back to an equal request.
   *
   * @example
   * ```ts
   * import { TerminalRunParams, TerminalSize } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalRunParams("example.chat/42", "npm test", "/tmp", [], null, new TerminalSize(120, 40)).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime's answer to `terminal.sessions`: every terminal it runs, which lets a reloaded window find its terminals.
 *
 * @example
 * ```ts
 * import { TerminalSessions, TerminalShellKind, TerminalSummary } from "@noldova/terminal.protocol";
 *
 * const summary = new TerminalSummary("session-1", "bash", "/home/user", "", null, false, false, null, true, null, "Bash", TerminalShellKind.Bash);
 * console.log(new TerminalSessions([summary]).toJson());
 * ```
 */
export declare class TerminalSessions {
  /**
   * The terminals' summaries, in the order the runtime gave them; the answer's own copy of the array given to the constructor.
   */
  public readonly sessions: readonly TerminalSummary[];

  /**
   * Creates the answer.
   *
   * @param sessions The terminals' summaries, which the answer copies; may be empty.
   *
   * @example
   * ```ts
   * import { TerminalSessions } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalSessions([]).sessions.length);
   * ```
   */
  public constructor(sessions: readonly TerminalSummary[]);

  /**
   * Reads the answer from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the field `sessions`, an array of {@link TerminalSummary} wire forms.
   * @returns The answer.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, `sessions` is missing or isn't an array, another field
   * is present, or a summary is refused as {@link TerminalSummary.fromJson} refuses it; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalSessions } from "@noldova/terminal.protocol";
   *
   * const answer = TerminalSessions.fromJson({
   *   sessions: [{ sessionId: "session-1", shellId: "bash", folder: "/home/user", title: "", exit: null, isAgentTerminal: false, isPanelTerminal: false,
   *     owner: null, opensTab: true, name: null, shellName: "Bash", shellKind: "Bash" }]
   * });
   * console.log(answer.sessions[0]?.shellId);
   * ```
   */
  public static fromJson(value: unknown): TerminalSessions;

  /**
   * Gives the answer's wire form.
   *
   * @returns A new plain object that {@link TerminalSessions.fromJson} reads back to an equal answer.
   *
   * @example
   * ```ts
   * import { TerminalSessions } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalSessions([]).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A shell the person can open in a terminal.
 *
 * @example
 * ```ts
 * import { TerminalShell, TerminalShellKind } from "@noldova/terminal.protocol";
 *
 * console.log(new TerminalShell("bash", "Bash", TerminalShellKind.Bash, true).toJson());
 * ```
 */
export declare class TerminalShell {
  /**
   * The shell's ID, which {@link TerminalOpenParams.shellId} names.
   */
  public readonly id: string;

  /**
   * The shell's name, which the person sees.
   */
  public readonly name: string;

  /**
   * The shell's kind.
   */
  public readonly kind: TerminalShellKind;

  /**
   * Whether a terminal opened without a shell ID runs this shell.
   */
  public readonly isDefault: boolean;

  /**
   * Creates a shell.
   *
   * @param id The shell's ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param name The shell's name: not blank, at most {@link Resources.maximumNameLength} UTF-16 code units.
   * @param kind The shell's kind.
   * @param isDefault Whether the shell is the default.
   * @throws {@link ArgumentException} Synchronously, when the ID or the name is blank or too long.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalShell, TerminalShellKind } from "@noldova/terminal.protocol";
   *
   * const shell = new TerminalShell("zsh", "Zsh", TerminalShellKind.Zsh, false);
   * try {
   *   new TerminalShell("zsh", " ", TerminalShellKind.Zsh, false);
   * }
   * catch (error) {
   *   console.log(shell.name, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(id: string, name: string, kind: TerminalShellKind, isDefault: boolean);

  /**
   * Reads a shell from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `id`, `name`, `kind`, one of {@link TerminalShellKind}'s wire
   * values, and `isDefault`.
   * @returns The shell.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field is missing, unknown, of the wrong type or
   * breaks the constructor's rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalShell } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalShell.fromJson({ id: "bash", name: "Bash", kind: "Bash", isDefault: true }).isDefault);
   * ```
   */
  public static fromJson(value: unknown): TerminalShell;

  /**
   * Reads a shell from a reader of its wire form, as a message that holds one does.
   *
   * @param reader A reader of the wire form, which {@link TerminalShell.fromJson} describes.
   * @returns The shell.
   * @throws {@link JsonException} Synchronously, as {@link TerminalShell.fromJson} does, with paths under the reader's path.
   *
   * @example
   * ```ts
   * import { ProtocolReader, TerminalShell } from "@noldova/terminal.protocol";
   *
   * const reader = ProtocolReader.fromValue({ id: "bash", name: "Bash", kind: "Bash", isDefault: false });
   * console.log(TerminalShell.fromReader(reader).id);
   * ```
   */
  public static fromReader(reader: ProtocolReader): TerminalShell;

  /**
   * Gives the shell's wire form.
   *
   * @returns A new plain object that {@link TerminalShell.fromJson} reads back to an equal shell.
   *
   * @example
   * ```ts
   * import { TerminalShell, TerminalShellKind } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalShell("bash", "Bash", TerminalShellKind.Bash, true).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime's answer to `terminal.shells`: the shells the person can open.
 *
 * @example
 * ```ts
 * import { TerminalShell, TerminalShellKind, TerminalShells } from "@noldova/terminal.protocol";
 *
 * console.log(new TerminalShells([new TerminalShell("bash", "Bash", TerminalShellKind.Bash, true)]).toJson());
 * ```
 */
export declare class TerminalShells {
  /**
   * The shells, in the order the runtime found them; the answer's own copy of the array given to the constructor.
   */
  public readonly shells: readonly TerminalShell[];

  /**
   * Creates the answer.
   *
   * @param shells The shells, which the answer copies; may be empty.
   *
   * @example
   * ```ts
   * import { TerminalShell, TerminalShellKind, TerminalShells } from "@noldova/terminal.protocol";
   *
   * const shells = new TerminalShells([
   *   new TerminalShell("bash", "Bash", TerminalShellKind.Bash, true),
   *   new TerminalShell("zsh", "Zsh", TerminalShellKind.Zsh, false)
   * ]);
   * console.log(shells.shells.find(t => t.isDefault)?.id);
   * ```
   */
  public constructor(shells: readonly TerminalShell[]);

  /**
   * Reads the answer from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the field `shells`, an array of {@link TerminalShell} wire forms.
   * @returns The answer.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, `shells` is missing or isn't an array, another field
   * is present, or a shell is refused as {@link TerminalShell.fromJson} refuses it; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalShells } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalShells.fromJson({ shells: [{ id: "bash", name: "Bash", kind: "Bash", isDefault: true }] }).shells.length);
   * ```
   */
  public static fromJson(value: unknown): TerminalShells;

  /**
   * Gives the answer's wire form.
   *
   * @returns A new plain object that {@link TerminalShells.fromJson} reads back to an equal answer.
   *
   * @example
   * ```ts
   * import { TerminalShells } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalShells([]).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The owner whose terminals a window shows, or none, as {@link TerminalNames.showOwnerMethod} sends it.
 *
 * @example
 * ```ts
 * import { TerminalNames, TerminalShowOwnerParams } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.showOwnerMethod, new TerminalShowOwnerParams("example.chat/42").toJson());
 * ```
 */
export declare class TerminalShowOwnerParams {
  /**
   * The owner the window shows, or `null` when it shows none.
   */
  public readonly owner: string | null;

  /**
   * Whether the window is hidden, as a minimized one is, so it can't fit a terminal until it shows again.
   */
  public readonly isHidden: boolean;

  /**
   * Creates the parameters.
   *
   * @param owner The owner the window shows, or `null` for none: when given, not blank, at most {@link Resources.maximumOwnerLength} UTF-16
   * code units.
   * @param isHidden Whether the window is hidden; `false` when left out.
   * @throws {@link ArgumentException} Synchronously, when the owner is blank or too long.
   *
   * @example
   * ```ts
   * import { TerminalShowOwnerParams } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalShowOwnerParams(null, true).isHidden);
   * ```
   */
  public constructor(owner: string | null, isHidden?: boolean);

  /**
   * Reads the parameters from their wire form.
   *
   * @param value The wire form, untrusted: an object with the field `owner`, a string or null, and optionally `isHidden`, a boolean, `false`
   * when missing, and no other field.
   * @returns The parameters.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or the field is missing, unknown, of the wrong type or
   * breaks the constructor's rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalShowOwnerParams } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalShowOwnerParams.fromJson({ owner: "example.chat/42" }).owner);
   * ```
   */
  public static fromJson(value: unknown): TerminalShowOwnerParams;

  /**
   * Gives the parameters' wire form.
   *
   * @returns A new plain object that {@link TerminalShowOwnerParams.fromJson} reads back to equal parameters.
   *
   * @example
   * ```ts
   * import { TerminalShowOwnerParams } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalShowOwnerParams(null).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A terminal's size in character cells.
 *
 * @example
 * ```ts
 * import { TerminalSize } from "@noldova/terminal.protocol";
 *
 * const size = new TerminalSize(80, 24);
 * console.log(size.toJson(), size.equals(new TerminalSize(80, 24)));
 * ```
 */
export declare class TerminalSize {
  /**
   * The number of columns; `cols` on the wire.
   */
  public readonly columns: number;

  /**
   * The number of rows.
   */
  public readonly rows: number;

  /**
   * Creates a size.
   *
   * @param columns The columns: an integer from {@link Resources.minimumColumns} to {@link Resources.maximumColumns}.
   * @param rows The rows: an integer from {@link Resources.minimumRows} to {@link Resources.maximumRows}.
   * @throws {@link ArgumentException} Synchronously, when a number isn't an integer in its range.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { Resources, TerminalSize } from "@noldova/terminal.protocol";
   *
   * const largest = new TerminalSize(Resources.maximumColumns, Resources.maximumRows);
   * try {
   *   new TerminalSize(80, 0);
   * }
   * catch (error) {
   *   console.log(largest.columns, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(columns: number, rows: number);

  /**
   * Reads a size from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `cols` and `rows`.
   * @returns The size.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field is missing, unknown, or isn't an integer
   * in its range; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalSize } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalSize.fromJson({ cols: 120, rows: 40 }).columns);
   * ```
   */
  public static fromJson(value: unknown): TerminalSize;

  /**
   * Reads a size from a reader of its wire form, as a message that holds one does.
   *
   * @param reader A reader of the wire form, which {@link TerminalSize.fromJson} describes.
   * @returns The size.
   * @throws {@link JsonException} Synchronously, as {@link TerminalSize.fromJson} does, with paths under the reader's path.
   *
   * @example
   * ```ts
   * import { ProtocolReader, TerminalSize } from "@noldova/terminal.protocol";
   *
   * const reader = ProtocolReader.fromValue({ size: { cols: 80, rows: 24 } });
   * console.log(TerminalSize.fromReader(reader.readObject("size")).rows);
   * ```
   */
  public static fromReader(reader: ProtocolReader): TerminalSize;

  /**
   * Tells whether another size has the same columns and rows.
   *
   * @param other The size to compare with.
   * @returns `true` when both sizes have the same columns and rows.
   *
   * @example
   * ```ts
   * import { TerminalSize } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalSize(80, 24).equals(new TerminalSize(24, 80)));
   * ```
   */
  public equals(other: TerminalSize): boolean;

  /**
   * Gives the size's wire form.
   *
   * @returns A new plain object that {@link TerminalSize.fromJson} reads back to an equal size.
   *
   * @example
   * ```ts
   * import { TerminalSize } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalSize(80, 24).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One terminal in the runtime's answer to `terminal.sessions`.
 *
 * @example
 * ```ts
 * import { TerminalShellKind, TerminalSummary } from "@noldova/terminal.protocol";
 *
 * console.log(new TerminalSummary("session-1", "bash", "/home/user", "~", null, false, false, null, true, null, "Bash", TerminalShellKind.Bash).toJson());
 * ```
 */
export declare class TerminalSummary {
  /**
   * The terminal's session ID.
   */
  public readonly sessionId: string;

  /**
   * The ID of the shell the terminal runs.
   */
  public readonly shellId: string;

  /**
   * The folder the shell started in.
   */
  public readonly folder: string;

  /**
   * The terminal's title; empty when the shell set none.
   */
  public readonly title: string;

  /**
   * How the shell ended, or `null` while it runs.
   */
  public readonly exit: TerminalExit | null;

  /**
   * Whether an agent session owns the terminal.
   */
  public readonly isAgentTerminal: boolean;

  /**
   * Whether the terminal is the one a window's terminal panel shows, rather than a tab's.
   */
  public readonly isPanelTerminal: boolean;

  /**
   * What the terminal is tied to, or `null` for a general terminal.
   */
  public readonly owner: string | null;

  /**
   * Whether a window opens a tab for the terminal as its owner shows: `false` for one a run without a tab opened, which an app shows in its
   * own pane, though the terminal stays listed and the person may still open its tab.
   */
  public readonly opensTab: boolean;

  /**
   * The name the person gave the terminal, which its tabs show in place of the shell's name, or `null` when it has none.
   */
  public readonly name: string | null;

  /**
   * The name of the shell the terminal runs, as `terminal.shells` lists it, so a window names a new tab without listing the shells, or
   * `null` when the summary was made without it.
   */
  public readonly shellName: string | null;

  /**
   * The kind of the shell the terminal runs, which picks its tab's icon.
   */
  public readonly shellKind: TerminalShellKind;

  /**
   * Creates a summary.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param shellId The shell's ID, with the same rules as the session ID.
   * @param folder The starting folder: not blank, at most {@link Resources.maximumPathLength} UTF-16 code units.
   * @param title The title: at most {@link Resources.maximumTitleLength} UTF-16 code units, and may be empty.
   * @param exit How the shell ended, or `null` while it runs.
   * @param isAgentTerminal Whether an agent session owns the terminal.
   * @param isPanelTerminal Whether the terminal is the panel's.
   * @param owner The owner: `null`, or not blank and at most {@link Resources.maximumOwnerLength} UTF-16 code units.
   * @param opensTab Whether a window opens the terminal's tab as its owner shows.
   * @param name The person's name for the terminal: `null`, or not blank and at most {@link Resources.maximumTitleLength} UTF-16 code units.
   * @param shellName The shell's name: `null`, or not blank and at most {@link Resources.maximumTitleLength} UTF-16 code units.
   * @param shellKind The shell's kind.
   * @throws {@link ArgumentException} Synchronously, when an ID, the folder, the owner, the name or the shell's name is blank or too long, or
   * the title is too long.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { EndedBy, TerminalExit, TerminalShellKind, TerminalSummary } from "@noldova/terminal.protocol";
   *
   * const summary = new TerminalSummary("session-1", "bash", "/home/user", "", new TerminalExit(0, EndedBy.Exit), true, false, null, true, null,
   *   "Bash", TerminalShellKind.Bash);
   * try {
   *   new TerminalSummary("session-1", "bash", "", "", null, false, false, null, true, null, "Bash", TerminalShellKind.Bash);
   * }
   * catch (error) {
   *   console.log(summary.isAgentTerminal, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(sessionId: string, shellId: string, folder: string, title: string, exit: TerminalExit | null, isAgentTerminal: boolean,
    isPanelTerminal: boolean, owner: string | null, opensTab: boolean, name: string | null, shellName: string | null, shellKind: TerminalShellKind);

  /**
   * Reads a summary from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `sessionId`, `shellId`, `folder`, `title`, `exit`, which may
   * be `null`, `isAgentTerminal`, `isPanelTerminal`, `owner`, which may be `null`, `opensTab`, `name` and `shellName`, which may be `null`,
   * and `shellKind`.
   * @returns The summary.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field, or a field of `exit`, is missing,
   * unknown, of the wrong type or breaks its rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalSummary } from "@noldova/terminal.protocol";
   *
   * const summary = TerminalSummary.fromJson({
   *   sessionId: "session-1",
   *   shellId: "bash",
   *   folder: "/home/user",
   *   title: "",
   *   exit: { exitCode: 0, endedBy: "Exit" },
   *   isAgentTerminal: false,
   *   isPanelTerminal: true,
   *   owner: null,
   *   opensTab: true,
   *   name: null,
   *   shellName: "Bash",
   *   shellKind: "Bash"
   * });
   * console.log(summary.exit?.exitCode);
   * ```
   */
  public static fromJson(value: unknown): TerminalSummary;

  /**
   * Reads a summary from a reader of its wire form, as a message that holds one does.
   *
   * @param reader A reader of the wire form, which {@link TerminalSummary.fromJson} describes.
   * @returns The summary.
   * @throws {@link JsonException} Synchronously, as {@link TerminalSummary.fromJson} does, with paths under the reader's path.
   *
   * @example
   * ```ts
   * import { ProtocolReader, TerminalSummary } from "@noldova/terminal.protocol";
   *
   * const reader = ProtocolReader.fromValue({ sessionId: "session-1", shellId: "bash", folder: "/tmp", title: "", exit: null, isAgentTerminal: true,
   *   isPanelTerminal: false, owner: null, opensTab: true, name: null, shellName: "Bash", shellKind: "Bash" });
   * console.log(TerminalSummary.fromReader(reader).isAgentTerminal);
   * ```
   */
  public static fromReader(reader: ProtocolReader): TerminalSummary;

  /**
   * Gives the summary's wire form.
   *
   * @returns A new plain object that {@link TerminalSummary.fromJson} reads back to an equal summary.
   *
   * @example
   * ```ts
   * import { TerminalShellKind, TerminalSummary } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalSummary("session-1", "bash", "/home/user", "", null, false, false, null, true, null, "Bash", TerminalShellKind.Bash).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A run of a stored line's text in one color and style.
 *
 * @remarks
 * A color is {@link Resources.defaultColor} for the terminal's default, a palette index from `0` to `255`, or an RGB color `0xRRGGBB`
 * offset by {@link Resources.rgbColor}.
 *
 * @example
 * ```ts
 * import { Resources, TerminalTextRun, TerminalTextStyle } from "@noldova/terminal.protocol";
 *
 * const orange = Resources.rgbColor + 0xff8800;
 * console.log(new TerminalTextRun(4, orange, Resources.defaultColor, TerminalTextStyle.Italic).toJson());
 * ```
 */
export declare class TerminalTextRun {
  /**
   * The run's length, in UTF-16 code units of the line's text.
   */
  public readonly length: number;

  /**
   * The text's color.
   */
  public readonly foreground: number;

  /**
   * The color behind the text.
   */
  public readonly background: number;

  /**
   * The sum of the run's {@link TerminalTextStyle} flags; `0` for plain text.
   */
  public readonly style: number;

  /**
   * Creates a run.
   *
   * @param length The run's length: an integer from `1` to {@link Resources.maximumLineLength}.
   * @param foreground The text's color: {@link Resources.defaultColor}, a palette index from `0` to `255`, or an integer from
   * {@link Resources.rgbColor} to {@link Resources.maximumColor}.
   * @param background The color behind the text, with the same rules as the foreground.
   * @param style The style: an integer from `0` to {@link Resources.maximumTextStyle}.
   * @throws {@link ArgumentException} Synchronously, when the length or the style isn't an integer in its range, or a color is no color.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { Resources, TerminalTextRun } from "@noldova/terminal.protocol";
   *
   * const run = new TerminalTextRun(1, 255, Resources.maximumColor, Resources.maximumTextStyle);
   * try {
   *   new TerminalTextRun(1, 256, Resources.defaultColor, 0);
   * }
   * catch (error) {
   *   console.log(run.foreground, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(length: number, foreground: number, background: number, style: number);

  /**
   * Reads a run from a reader of its wire form, as a line does.
   *
   * @param reader A reader of the wire form: an object with exactly the fields `length`, `foreground`, `background` and `style`.
   * @returns The run.
   * @throws {@link JsonException} Synchronously, when a field is missing, unknown, or isn't an integer: `length` from `1` to
   * {@link Resources.maximumLineLength}, a color from {@link Resources.defaultColor} to {@link Resources.maximumColor}, or `style` from
   * `0` to {@link Resources.maximumTextStyle}; the exception's path names the field.
   * @throws {@link JsonException} Synchronously, also when a color lies between the palette and the RGB colors, at the field's path, with
   * the constructor's `ArgumentException` as its cause.
   *
   * @example
   * ```ts
   * import { ProtocolReader, TerminalTextRun } from "@noldova/terminal.protocol";
   *
   * const reader = ProtocolReader.fromValue({ length: 3, foreground: 1, background: -1, style: 0 });
   * console.log(TerminalTextRun.fromReader(reader).foreground);
   * ```
   */
  public static fromReader(reader: ProtocolReader): TerminalTextRun;

  /**
   * Gives the run's wire form.
   *
   * @returns A new plain object that {@link TerminalTextRun.fromReader} reads back to an equal run.
   *
   * @example
   * ```ts
   * import { Resources, TerminalTextRun } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalTextRun(3, Resources.defaultColor, Resources.defaultColor, 0).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime's event that a terminal's title changed.
 *
 * @example
 * ```ts
 * import { TerminalNames, TerminalTitle } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.titleChangedEvent, new TerminalTitle("session-1", "build").toJson());
 * ```
 */
export declare class TerminalTitle {
  /**
   * The terminal's session ID.
   */
  public readonly sessionId: string;

  /**
   * The terminal's new title; empty when the shell cleared it.
   */
  public readonly title: string;

  /**
   * Creates the event.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param title The title: at most {@link Resources.maximumTitleLength} UTF-16 code units, and may be empty.
   * @throws {@link ArgumentException} Synchronously, when the session ID is blank or too long, or the title is too long.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { Resources, TerminalTitle } from "@noldova/terminal.protocol";
   *
   * const title = new TerminalTitle("session-1", "");
   * try {
   *   new TerminalTitle("session-1", "x".repeat(Resources.maximumTitleLength + 1));
   * }
   * catch (error) {
   *   console.log(title.title.length, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(sessionId: string, title: string);

  /**
   * Reads the event from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `sessionId` and `title`.
   * @returns The event.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field is missing, unknown, of the wrong type or
   * breaks the constructor's rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalTitle } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalTitle.fromJson({ sessionId: "session-1", title: "build" }).title);
   * ```
   */
  public static fromJson(value: unknown): TerminalTitle;

  /**
   * Gives the event's wire form.
   *
   * @returns A new plain object that {@link TerminalTitle.fromJson} reads back to an equal event.
   *
   * @example
   * ```ts
   * import { TerminalTitle } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalTitle("session-1", "build").toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The window part's report of whether one of its panes is shown; only a shown pane's unacknowledged output pauses the shell.
 *
 * @example
 * ```ts
 * import { TerminalNames, TerminalVisibilityParams } from "@noldova/terminal.protocol";
 *
 * console.log(TerminalNames.visibilityMethod, new TerminalVisibilityParams("session-1", "pane-1", false).toJson());
 * ```
 */
export declare class TerminalVisibilityParams {
  /**
   * The terminal's session ID.
   */
  public readonly sessionId: string;

  /**
   * The pane's ID.
   */
  public readonly paneId: string;

  /**
   * Whether the pane is shown; `visible` on the wire.
   */
  public readonly isVisible: boolean;

  /**
   * Creates the report.
   *
   * @param sessionId The terminal's session ID: not blank, at most {@link Resources.maximumIdentifierLength} UTF-16 code units.
   * @param paneId The pane's ID, with the same rules as the session ID.
   * @param isVisible Whether the pane is shown.
   * @throws {@link ArgumentException} Synchronously, when an ID is blank or too long.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { TerminalVisibilityParams } from "@noldova/terminal.protocol";
   *
   * const report = new TerminalVisibilityParams("session-1", "pane-1", true);
   * try {
   *   new TerminalVisibilityParams("session-1", " ", true);
   * }
   * catch (error) {
   *   console.log(report.isVisible, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(sessionId: string, paneId: string, isVisible: boolean);

  /**
   * Reads the report from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `sessionId`, `paneId` and `visible`.
   * @returns The report.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, or a field is missing, unknown, of the wrong type or
   * breaks the constructor's rules; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { TerminalVisibilityParams } from "@noldova/terminal.protocol";
   *
   * console.log(TerminalVisibilityParams.fromJson({ sessionId: "session-1", paneId: "pane-1", visible: true }).isVisible);
   * ```
   */
  public static fromJson(value: unknown): TerminalVisibilityParams;

  /**
   * Gives the report's wire form.
   *
   * @returns A new plain object that {@link TerminalVisibilityParams.fromJson} reads back to an equal report.
   *
   * @example
   * ```ts
   * import { TerminalVisibilityParams } from "@noldova/terminal.protocol";
   *
   * console.log(new TerminalVisibilityParams("session-1", "pane-1", true).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The Windows pseudo-terminal a shell runs in, which a pane needs to draw that pseudo-terminal's output as it means it.
 *
 * @example
 * ```ts
 * import { WindowsPty } from "@noldova/terminal.protocol";
 *
 * console.log(new WindowsPty(22631).toJson());
 * ```
 */
export declare class WindowsPty {
  /**
   * The build number of the Windows the shell runs on.
   */
  public readonly buildNumber: number;

  /**
   * Creates the pseudo-terminal's description.
   *
   * @param buildNumber The Windows build number: an integer from `0` to {@link Resources.maximumBuildNumber}.
   * @throws {@link ArgumentException} Synchronously, when the build number isn't an integer in its range.
   *
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/context.exceptions";
   * import { WindowsPty } from "@noldova/terminal.protocol";
   *
   * const pty = new WindowsPty(0);
   * try {
   *   new WindowsPty(-1);
   * }
   * catch (error) {
   *   console.log(pty.buildNumber, error instanceof ArgumentException);
   * }
   * ```
   */
  public constructor(buildNumber: number);

  /**
   * Reads the description from its wire form.
   *
   * @param value The wire form, untrusted: an object with exactly the fields `backend`, which must be {@link Resources.conptyBackend},
   * and `buildNumber`.
   * @returns The description.
   * @throws {@link JsonException} Synchronously, when the value isn't an object, a field is missing or unknown, `backend` isn't
   * {@link Resources.conptyBackend}, or `buildNumber` isn't an integer in its range; the exception's path names the field.
   *
   * @example
   * ```ts
   * import { WindowsPty } from "@noldova/terminal.protocol";
   *
   * console.log(WindowsPty.fromJson({ backend: "conpty", buildNumber: 22631 }).buildNumber);
   * ```
   */
  public static fromJson(value: unknown): WindowsPty;

  /**
   * Reads the description from a reader of its wire form, as an attachment does.
   *
   * @param reader A reader of the wire form, which {@link WindowsPty.fromJson} describes.
   * @returns The description.
   * @throws {@link JsonException} Synchronously, as {@link WindowsPty.fromJson} does, with paths under the reader's path.
   *
   * @example
   * ```ts
   * import { ProtocolReader, WindowsPty } from "@noldova/terminal.protocol";
   *
   * const reader = ProtocolReader.fromValue({ backend: "conpty", buildNumber: 19045 });
   * console.log(WindowsPty.fromReader(reader).buildNumber);
   * ```
   */
  public static fromReader(reader: ProtocolReader): WindowsPty;

  /**
   * Gives the description's wire form, with `backend` set to {@link Resources.conptyBackend}.
   *
   * @returns A new plain object that {@link WindowsPty.fromJson} reads back to an equal description.
   *
   * @example
   * ```ts
   * import { WindowsPty } from "@noldova/terminal.protocol";
   *
   * console.log(new WindowsPty(22631).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

export {};
