/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EnvironmentInjector, Signal } from "@angular/core";
import type { IWindowPart, IWindowPartContext } from "@noldova/desktop.window";
import type { Exception, ExceptionOptions } from "@noldova/context.exceptions";
import type { TerminalRunBusy, TerminalRunOutcome, TerminalRunOutput, TerminalShellKind } from "@noldova/terminal.protocol";

/**
 * The kinds of shell, re-exported from `@noldova/terminal.protocol`: `PowerShell`, `CommandPrompt`, `Bash`, `Zsh`, `Fish`, `Wsl` and
 * `Other`. {@link TerminalOwners.runAsync} takes a list of them.
 */
export { TerminalShellKind } from "@noldova/terminal.protocol";

/**
 * What became of a run's commands, re-exported from `@noldova/terminal.protocol`: `Typed`, or why they weren't typed, `Input`, `Tab`,
 * `Ended`, `Busy`, or `NoShell` when no shell of the run's kinds is installed, so nothing opened. {@link TerminalRunNotTypedException}
 * carries the reasons but `NoShell`, for which {@link RunShellKindsMissingException} is thrown instead.
 */
export { TerminalRunOutcome } from "@noldova/terminal.protocol";

/**
 * What a run into a given terminal does while that terminal's shell is busy, re-exported from `@noldova/terminal.protocol`: `Refuse` or
 * `Interrupt`. A {@link TerminalRunTarget} carries it.
 */
export { TerminalRunBusy } from "@noldova/terminal.protocol";

/**
 * A run's output with its colors, its last lines and how many earlier ones were cut, re-exported from `@noldova/terminal.protocol`.
 * {@link TerminalOwners.readRunOutputAsync} gives it.
 */
export { TerminalRunOutput } from "@noldova/terminal.protocol";

/**
 * A line of a run's output: its text, whether it continues the line before, and its runs of color and style, re-exported from
 * `@noldova/terminal.protocol`.
 */
export { TerminalLine } from "@noldova/terminal.protocol";

/**
 * A run of a line's text in one color and style, re-exported from `@noldova/terminal.protocol`; its colors are read with
 * {@link TerminalOwners.defaultColor} and {@link TerminalOwners.rgbColor}.
 */
export { TerminalTextRun } from "@noldova/terminal.protocol";

/**
 * The style flags of a line's text run, whose sum is the run's style, re-exported from `@noldova/terminal.protocol`: `Bold`, `Dim`,
 * `Italic`, `Underline`, `Blink`, `Inverse`, `Invisible`, `Strikethrough` and `Overline`.
 */
export { TerminalTextStyle } from "@noldova/terminal.protocol";

/**
 * The terminal module's window part, which Noldova Desktop's window activates.
 *
 * @remarks
 * Activation registers the bottom panel `terminal.panel`, the bottom view `terminal.session` with a tab for each instance, a session's id, and
 * the command `terminal.new`, which opens a terminal in a new tab: in the `folder` and with the `shellId` its arguments give, else in the app's
 * {@link TerminalStartFolder} with the default shell, in the `tabGroup` it gives, else where Noldova Desktop chooses, for the `owner` it gives, else
 * without one, or with `takesNewOwner: true` for the app's new owner ({@link TerminalOwners}); its key is Ctrl+Shift+\`, and the View menu has it. The command `terminal.toggle`, Toggle Terminal, on Ctrl+\` (Control on macOS), shows the terminal used last and gives it the
 * focus, else opens one, and from a terminal gives the focus back to where it was and hides the terminal's dock. The default shell is the
 * `terminal.defaultShell` setting's while the runtime finds it, else the runtime's. Every tab row that holds a terminal tab shows + and a menu of
 * the shells, which open a terminal in that group: the default shell's row runs `terminal.new` and shows its key, and the others run
 * `terminal.newWithShell`, which has no key and stays out of command search; + takes the app's new owner, and the rows open a terminal without
 * one. The tab menu of a terminal tab, but an agent's, and of the panel offers Restart, the command
 * `terminal.restartShell`, which starts its shell again in place. A terminal tab is renamed in place, as Noldova Desktop edits a renamable tab's
 * title, by a double-click, F2 or its own tab-menu Rename: Enter keeps the name, for its tabs in every window and across runs, Escape
 * cancels, and an empty title takes it away. The panel shows a terminal of its own, which no tab shows: the one the runtime lists as
 * the panel's, or the default shell it opens the first time it shows. xterm and the pane load with the first panel or tab that shows.
 * Closing a tab ends its terminal, unless an agent's session owns it; activation reopens a tab for each of the person's terminals the runtime
 * still has, but the panel's, so a reload keeps them. Before that it has the runtime open again, once a run, the terminals the last run left
 * open, so a new start of the app keeps them too.
 * After the runtime starts again, the part has it open the last run's terminals again first, and every pane attaches again from a snapshot;
 * a pane whose terminal is gone keeps its last screen with a Restart action.
 * @example
 * ```ts
 * import type { IWindowPartContext } from "@noldova/desktop.window";
 * import { windowPart } from "@noldova/terminal/window";
 *
 * export async function activateTerminalAsync(context: IWindowPartContext): Promise<void> {
 *   await windowPart.activateAsync(context);
 * }
 * ```
 */
export declare const windowPart: IWindowPart;

/**
 * The base of every exception the window part throws, which a caller can catch to handle any of them.
 *
 * @example
 * ```ts
 * import { TerminalNotActiveException, TerminalWindowException } from "@noldova/terminal/window";
 *
 * console.log(new TerminalNotActiveException() instanceof TerminalWindowException);
 * ```
 */
export declare class TerminalWindowException extends Exception {
  /**
   * `"TerminalWindowException"`, which a subclass replaces with its own.
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
   * import { TerminalWindowException } from "@noldova/terminal/window";
   *
   * const cause = new Error("The runtime closed.");
   * console.log(new TerminalWindowException("The window failed.", new ExceptionOptions(cause)).cause === cause);
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * Thrown when a window that already has a start folder provider is given another.
 *
 * @example
 * ```ts
 * import type { IWindowPartContext } from "@noldova/desktop.window";
 * import { StartFolderProvidedException, TerminalStartFolder } from "@noldova/terminal/window";
 *
 * export function provideHomeFolder(context: IWindowPartContext): void {
 *   try {
 *     TerminalStartFolder.provide(context, () => null);
 *   }
 *   catch (error) {
 *     console.log(error instanceof StartFolderProvidedException);
 *   }
 * }
 * ```
 */
export declare class StartFolderProvidedException extends TerminalWindowException {
  /**
   * `"StartFolderProvidedException"`.
   */
  public override readonly name: string;

  /**
   * Creates the exception, whose message says to remove the first provider before providing another.
   *
   * @example
   * ```ts
   * import { StartFolderProvidedException } from "@noldova/terminal/window";
   *
   * console.log(new StartFolderProvidedException().message);
   * ```
   */
  public constructor();
}

/**
 * The folder an app starts new terminals in. The terminal asks for it each time it opens a terminal without a folder of its own, such as the
 * panel's first terminal and `terminal.new` without a `folder` argument.
 *
 * @remarks
 * The home folder stands in when no app provides a folder, the provider gives `null`, or it gives a folder that is blank, relative or longer
 * than the protocol's `Resources.maximumPathLength`, which the providing app's log says. A folder that no longer exists opens the terminal in
 * the home folder too, which the module's log and the terminal's first line say.
 */
export declare class TerminalStartFolder {
  /**
   * Provides the window's start folder.
   *
   * @param context The providing app part's context, whose log says when its folder is refused.
   * @param folder Gives the folder, an absolute path, or `null` for the home folder; it is called at each open.
   * @returns A function that removes the provider.
   * @throws {@link StartFolderProvidedException} Synchronously, when the window already has a provider.
   *
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import { TerminalStartFolder } from "@noldova/terminal/window";
   *
   * export function provideProjectFolder(context: IWindowPartContext, project: { readonly folder: string | null }): () => void {
   *   const unregister: () => void = TerminalStartFolder.provide(context, () => project.folder);
   *   return unregister;
   * }
   * ```
   */
  public static provide(context: IWindowPartContext, folder: () => string | null): () => void;

  /**
   * Reads the start folder as the next terminal would open in it.
   *
   * @returns The provided folder, or `null` for the home folder.
   *
   * @example
   * ```ts
   * import { TerminalStartFolder } from "@noldova/terminal/window";
   *
   * console.log(TerminalStartFolder.read());
   * ```
   */
  public static read(): string | null;
}

/**
 * Thrown when a window that already has an owners provider is given another.
 *
 * @example
 * ```ts
 * import type { IWindowPartContext } from "@noldova/desktop.window";
 * import { OwnersProvidedException, TerminalOwners } from "@noldova/terminal/window";
 *
 * export function provideNoOwner(context: IWindowPartContext): void {
 *   try {
 *     TerminalOwners.provide(context, () => null);
 *   }
 *   catch (error) {
 *     console.log(error instanceof OwnersProvidedException);
 *   }
 * }
 * ```
 */
export declare class OwnersProvidedException extends TerminalWindowException {
  /**
   * `"OwnersProvidedException"`.
   */
  public override readonly name: string;

  /**
   * Creates the exception, whose message says to remove the first provider before providing another.
   *
   * @example
   * ```ts
   * import { OwnersProvidedException } from "@noldova/terminal/window";
   *
   * console.log(new OwnersProvidedException().message);
   * ```
   */
  public constructor();
}

/**
 * What an app ties a window's terminals to, such as its chats: an owner, a string of 1 to 256 UTF-16 code units the app chooses, which
 * Terminal only compares.
 *
 * @remarks
 * The window shows the terminals without an owner and one owner's at a time. Another owner's terminals have no tab: their shells keep running
 * and the runtime keeps their output, and their tabs open again when their owner shows. The window starts with no owner shown, so after a
 * reload the app shows its current owner again. The panel's terminal never has an owner.
 */
export declare class TerminalOwners {
  private constructor();

  /**
   * The longest commands {@link TerminalOwners.runAsync} takes, `16384` UTF-16 code units.
   */
  public static readonly maximumCommandLength: number;

  /**
   * The most lines {@link TerminalOwners.readRunOutputAsync} gives when not asked for fewer or more, `2000`.
   */
  public static readonly defaultRunLines: number;

  /**
   * The most lines {@link TerminalOwners.readRunOutputAsync} gives, `5000`.
   */
  public static readonly maximumRunLines: number;

  /**
   * The color of an output line's text run that stands for the terminal's default foreground or background, `-1`; another color is a palette
   * index from `0` to `255`, or an RGB color.
   */
  public static readonly defaultColor: number;

  /**
   * The offset of an RGB color in an output line's text run, `16777216` (`0x1000000`): a color `rgbColor + 0xRRGGBB` stands for that RGB
   * color.
   */
  public static readonly rgbColor: number;

  /**
   * The owner whose terminals the window shows, or `null`.
   */
  public static get shown(): string | null;

  /**
   * Provides the window's owners.
   *
   * @param context The providing app part's context, which makes the owners' requests and whose log says when its new owner is refused; the
   * tabs open and close through Terminal's own window part, since a part may open and close only its own module's views.
   * @param newOwner Gives the owner that a terminal from Terminal's + and Toggle Terminal's first open takes, or `null` for none; it is called
   * at each open. A blank or over-long owner, or one it throws for, opens a terminal without an owner. The shell menu's rows, Ctrl+Shift+\`
   * and the View menu open a terminal without an owner, whatever it gives.
   * @returns The window's owners.
   * @throws {@link OwnersProvidedException} Synchronously, when the window already has a provider.
   *
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import { TerminalOwners } from "@noldova/terminal/window";
   *
   * export function provideChatOwners(context: IWindowPartContext, chat: { readonly id: string }): TerminalOwners {
   *   const owners = TerminalOwners.provide(context, () => `example.chat/${chat.id}`);
   *   return owners;
   * }
   * ```
   */
  public static provide(context: IWindowPartContext, newOwner: () => string | null): TerminalOwners;

  /**
   * Reads the new owner as the next terminal from Terminal's own entries would take it.
   *
   * @returns The provided owner, or `null` for none.
   *
   * @example
   * ```ts
   * import { TerminalOwners } from "@noldova/terminal/window";
   *
   * console.log(TerminalOwners.readNewOwner());
   * ```
   */
  public static readNewOwner(): string | null;

  /**
   * Checks commands as {@link TerminalOwners.runAsync} does, so an app can offer Run only for commands it takes.
   *
   * @param command The commands.
   * @returns `true` when they aren't blank, have at most {@link TerminalOwners.maximumCommandLength} UTF-16 code units, hold no control
   * character but line feeds, carriage returns before line feeds, and tabs, and no format or default-ignorable character outside an emoji,
   * such as a bidirectional mark, a zero-width character or a variation selector, which would make them read differently from what runs.
   * A tab may still keep them from being typed, into a shell without bracketed paste ({@link TerminalRunNotTypedException}).
   *
   * @example
   * ```ts
   * import { TerminalOwners } from "@noldova/terminal/window";
   *
   * console.log(TerminalOwners.canRun("npm install\nnpm test"));
   * ```
   */
  public static canRun(command: string): boolean;

  /**
   * Shows the owner's terminals in this window, in the order they opened, and hides every other owner's. While Terminal's window part isn't
   * active, or once it stops during the show, it only sets the owner, whose tabs open as the part activates.
   *
   * @param owner The owner, or `null` to hide every owned terminal.
   * @returns A promise that resolves once the tabs have opened and closed; the shows run in the order asked, and one that rejects leaves the
   * window as it was.
   * @throws `ArgumentException` Synchronously, when the owner is blank or too long.
   *
   * @example
   * ```ts
   * import type { TerminalOwners } from "@noldova/terminal/window";
   *
   * export async function showChatAsync(owners: TerminalOwners, chat: { readonly id: string }): Promise<void> {
   *   await owners.showAsync(`example.chat/${chat.id}`);
   * }
   * ```
   */
  public showAsync(owner: string | null): Promise<void>;

  /**
   * Ends every terminal of the owner, in every window, as closing its tab does, and forgets them for the next run; each window closes their
   * tabs.
   *
   * @param owner The owner.
   * @returns A promise that resolves once the runtime has ended them; it rejects with an `ArgumentException` when the owner is blank or too
   * long.
   *
   * @example
   * ```ts
   * import type { TerminalOwners } from "@noldova/terminal/window";
   *
   * export async function closeChatAsync(owners: TerminalOwners, chat: { readonly id: string }): Promise<void> {
   *   await owners.closeAsync(`example.chat/${chat.id}`);
   * }
   * ```
   */
  public closeAsync(owner: string): Promise<void>;

  /**
   * Runs commands the person asked to run, such as a chat's shell code block, in a terminal of the owner, as pasting them there and pressing
   * Enter would.
   *
   * @remarks
   * The runtime types them into the owner's newest terminal that is free: a person's terminal, not an agent's, whose shell is running, has the
   * shell integration, is of one of the kinds, is in the run's folder, and is at its prompt with nothing typed after it and no keys within the
   * last second. A terminal is in the folder when the folder its shell last reported is, or its start folder while it reported no absolute
   * one, and none for a Git Bash report outside the drives, both as the file system resolves them within a second or else as written,
   * whatever a trailing separator and, on Windows, case and slashes; a folder that no longer exists counts as the home folder, and a run
   * with no folder takes any terminal. A run's end
   * comes before the shell draws its next prompt, so when the owner's newest such terminal is still drawing its prompt, the runtime waits up to
   * 10 seconds for it, holding it as a run that is starting, and types there once it is free; the wait ends when the terminal closes, and a
   * terminal still not free after it is passed over.
   * While the owner's terminals or the connection's are closing, a run that names none types nothing and fails as `Ended`, naming the newest
   * of them. When there is none yet, as while the owner's only terminal is still opening, a run caught by its owner's close waits for the close
   * to end and then runs as usual, in a new terminal, and a run whose own connection is closing fails at once and opens nothing. A shell
   * without the integration, such as Command Prompt, can't be told free, so each run there opens a new terminal. With no free terminal, it
   * opens one for the owner in the folder, with the window's default shell when it is of the kinds or none are given, else the first installed
   * shell of the kinds, and types them once the shell is ready; with no shell of the kinds installed, nothing opens or is typed, since a shell
   * of another kind would read them differently. Their line breaks are typed as Enter inside a bracketed paste when the shell asked for one,
   * so several lines run as their paste would, and Enter follows once; blank lines at their start and line breaks at their end are dropped,
   * so the first command stays on the prompt's line. Terminal never logs them.
   * While the window shows the owner, the terminal's tab shows and its pane takes the focus, as a new terminal's does; a terminal of another
   * owner gets its tab when that owner shows, so the app shows the owner first.
   *
   * @param owner The owner: not blank, at most 256 UTF-16 code units.
   * @param command The commands, as {@link TerminalOwners.canRun} checks them.
   * @param folder The absolute folder a new terminal starts in, or `null` for the app's {@link TerminalStartFolder}, else the person's home
   * folder, which also stands in for a folder that no longer exists.
   * @param shellKinds The kinds of shell that may run them, such as Bash and Zsh for a `bash` block; an empty list means any.
   * @returns A promise of the terminal's session id, once the runtime has typed the commands, onto an empty prompt line with nothing typed
   * since it picked the terminal, and the tab has opened; a new terminal's tab opens first, and the commands go in once its pane gave the
   * terminal its size, so they draw at the pane's width.
   * @throws {@link TerminalRunRefusedException} As the promise's rejection, never synchronously, before anything opens or is typed, when
   * Terminal's window part isn't active, or the owner, the commands, the folder or a kind is refused, or for `shellKinds` when no shell of the
   * kinds is installed, with a message that names them, such as "The commands weren't run, and nothing opened: no shell of the kinds they need
   * is installed (Bash or Zsh)."
   * @throws {@link TerminalRunNotTypedException} As the promise's rejection, once the tab has opened, when the runtime picked or opened a
   * terminal but didn't type the commands; the promise rejects with what the runtime rejects with when it fails the run otherwise.
   *
   * @example
   * ```ts
   * import { TerminalOwners, TerminalShellKind } from "@noldova/terminal/window";
   *
   * export async function runBlockAsync(owners: TerminalOwners, chat: { readonly id: string; readonly folder: string | null },
   *   block: { readonly text: string }): Promise<void> {
   *   const owner = `example.chat/${chat.id}`;
   *   await owners.showAsync(owner);
   *   if (TerminalOwners.canRun(block.text))
   *     await owners.runAsync(owner, block.text, chat.folder, [TerminalShellKind.Bash, TerminalShellKind.Zsh]);
   * }
   * ```
   */
  public runAsync(owner: string, command: string, folder: string | null, shellKinds: readonly TerminalShellKind[]): Promise<string>;

  /**
   * Runs commands as {@link TerminalOwners.runAsync} does, or into one given terminal, and gives the run, whose output
   * {@link TerminalOwners.readRunOutputAsync} reads; `runAsync` is this with no target, giving the run's session id.
   *
   * @remarks
   * With a target, the commands go only into that terminal, which must be a person's terminal of the owner, of one of the kinds, that the
   * window reaches, such as one an app shows with {@link EmbeddedTerminal} under the commands; no tab opens or shows, since the app shows the
   * terminal itself, and the folder isn't used. For any other target, as for one that ended, closed or restarted, the run fails as `Ended`,
   * alike, so the app runs the commands in a new terminal. A target still drawing its prompt, as right after the last run's end, is waited for
   * first, up to 10 seconds, held as a run that is starting, and the wait ends when the terminal closes. A target whose owner's terminals or connection's are closing fails
   * as `Ended` at once and types nothing. While the target's shell is then busy, running a command or with text on its prompt line, or
   * always for a shell without the shell integration, which can't be told free, a run whose target says `Refuse` types nothing and fails as
   * `Busy`; one that says `Interrupt` waits up to two seconds for a command to start, sends it Ctrl+C, waits up to two seconds more for the
   * shell to be back at an empty prompt, then types, else fails as `Busy`; a line that doesn't start gets no Ctrl+C. A run that comes while another run into the target is still starting types nothing and fails as `Busy` too.
   *
   * With `shown`, no tab opens or takes the focus for the run's terminal, whether the run picks a free one, opens a new one or is given a
   * target, and none opens later as the owner shows, since the app shows the terminal in its own pane; the terminal stays in the window's list
   * and the agents' tools, and its tab opens only when the person opens it. `shown` gets the terminal's session ID before anything is typed:
   * the app attaches its pane then, and a new terminal waits up to 10 seconds for that pane's first fit before the commands are typed
   * at its size; it starts at 80 columns at once when the window closes or detaches the pane first, or once the 10 seconds pass. A window's runs with `shown` start one at a time.
   *
   * @param owner The owner: not blank, at most 256 UTF-16 code units.
   * @param command The commands, as {@link TerminalOwners.canRun} checks them.
   * @param folder The absolute folder a new terminal starts in, or `null`, as {@link TerminalOwners.runAsync} takes it.
   * @param shellKinds The kinds of shell that may run them; an empty list means any.
   * @param target The terminal the commands go into, and what a busy one gets, or `null` for the runtime's choice, as
   * {@link TerminalOwners.runAsync} makes it.
   * @param shown Called once with the terminal's session ID before the commands are typed, for a run without a tab, or `null`, the default,
   * for a run whose terminal's tab opens as {@link TerminalOwners.runAsync} opens it.
   * @returns A promise of the run, once the runtime has typed the commands and, without a target or `shown`, the tab has opened.
   * @throws {@link TerminalRunRefusedException} As the promise's rejection, never synchronously, before anything opens or is typed, as
   * {@link TerminalOwners.runAsync} rejects with it, or for `sessionId` or `whenBusy` when the target's own fields are refused.
   * @throws {@link TerminalRunNotTypedException} As the promise's rejection, when the runtime picked, opened or was given a terminal but didn't
   * type the commands, with
   * the reason `Busy` for a busy target, and `Ended` for a target that isn't a person's terminal of the owner, of one of the kinds, that the
   * window reaches; the promise rejects with what the runtime rejects with when it fails the run otherwise.
   *
   * @example
   * ```ts
   * import { TerminalRunBusy, TerminalRunTarget, type TerminalOwners } from "@noldova/terminal/window";
   *
   * export async function runTestsAsync(owners: TerminalOwners, chat: { readonly id: string }, sessionId: string): Promise<void> {
   *   const target = new TerminalRunTarget(sessionId, TerminalRunBusy.Interrupt);
   *   const run = await owners.startRunAsync(`example.chat/${chat.id}`, "npm test", null, [], target);
   *   console.log(run.runId);
   * }
   * ```
   */
  public startRunAsync(owner: string, command: string, folder: string | null, shellKinds: readonly TerminalShellKind[],
    target: TerminalRunTarget | null, shown?: ((sessionId: string) => void) | null): Promise<TerminalRun>;

  /**
   * Reads a run's output with its colors, such as to show it or hand it on after the person ran a block.
   *
   * @remarks
   * The output holds the run's lines from the prompt where its commands were typed up to the prompt where the next run into the same terminal
   * typed, or up to the cursor's line for the terminal's latest run, so the commands the person typed in between are in it. It gives the last
   * of them, at most the number asked, each from a line's start, never the rest of a wrapped line, and `cutLines` counts the earlier lines it
   * left out: those over the limit, and those the terminal no longer holds, such as lines past what it keeps of its scrollback or ones the
   * shell erased, as `clear` does. Only a person's terminals' runs are read, and no agent tool reads them.
   *
   * @param run The run, from {@link TerminalOwners.startRunAsync}.
   * @param maximumLines The most lines: a whole number from `1` to {@link TerminalOwners.maximumRunLines};
   * {@link TerminalOwners.defaultRunLines} when left out.
   * @returns A promise of the output.
   * @throws {@link RunLinesRefusedException} As the promise's rejection, never synchronously, when the number of lines isn't a whole number in
   * its range, before anything is asked.
   * @throws {@link TerminalRunNotFoundException} As the promise's rejection, when the run's ids can't name a run, before anything is asked, or
   * when the runtime can't give the run: its terminal never had it or no longer keeps it, as it keeps its latest 100 runs, its shell ended or
   * restarted, or the runtime no longer has its terminal, such as after it started again; the promise rejects with what the runtime rejects
   * with when it fails the read otherwise.
   *
   * @example
   * ```ts
   * import { TerminalRunNotFoundException, type TerminalLine, type TerminalOwners, type TerminalRun } from "@noldova/terminal/window";
   *
   * export async function logOutputAsync(owners: TerminalOwners, run: TerminalRun): Promise<void> {
   *   try {
   *     const output = await owners.readRunOutputAsync(run, 200);
   *     console.log(output.lines.map((t: TerminalLine) => t.text).join("\n"), output.cutLines);
   *   }
   *   catch (error) {
   *     console.log(error instanceof TerminalRunNotFoundException);
   *   }
   * }
   * ```
   */
  public readRunOutputAsync(run: TerminalRun, maximumLines?: number): Promise<TerminalRunOutput>;

  /**
   * Hides every owned terminal and removes the provider, so another can be provided; it does nothing once removed.
   *
   * @returns A promise that resolves once the tabs have closed.
   *
   * @example
   * ```ts
   * import type { TerminalOwners } from "@noldova/terminal/window";
   *
   * export async function removeOwnersAsync(owners: TerminalOwners): Promise<void> {
   *   await owners.removeAsync();
   * }
   * ```
   */
  public removeAsync(): Promise<void>;
}

/**
 * The base of the exceptions {@link TerminalOwners.runAsync} and {@link TerminalOwners.startRunAsync} throw when they refuse a run, before
 * anything opened or was typed, which a caller catches to handle any refusal; each refusal is its own subclass.
 *
 * @example
 * ```ts
 * import { TerminalRunRefusedException, type TerminalOwners } from "@noldova/terminal/window";
 *
 * export async function runInRelativeFolderAsync(owners: TerminalOwners): Promise<void> {
 *   try {
 *     await owners.runAsync("example.chat/42", "ls", "work", []);
 *   }
 *   catch (error) {
 *     console.log(error instanceof TerminalRunRefusedException && error.parameter);
 *   }
 * }
 * ```
 */
export declare abstract class TerminalRunRefusedException extends TerminalWindowException {
  /**
   * `"TerminalRunRefusedException"`, which a subclass replaces with its own.
   */
  public override readonly name: string;

  /**
   * The refused field: `owner`, `command`, `folder`, a kind such as `shellKinds.1`, `sessionId` or `whenBusy` for a target's refused
   * field, `shellKinds` when no shell of the kinds is installed, or `context` while the terminal's window part isn't active. The exception
   * never carries the commands.
   */
  public abstract readonly parameter: string;

  /**
   * Creates the exception, for a subclass.
   *
   * @param message The message, which says that nothing ran or opened, and why.
   * @param options The options, such as the error that caused this one.
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * Thrown when {@link TerminalOwners.runAsync} or {@link TerminalOwners.startRunAsync} is called while Terminal's window part isn't active in
 * the window, before anything opened or was typed.
 *
 * @example
 * ```ts
 * import { RunPartInactiveException, type TerminalOwners } from "@noldova/terminal/window";
 *
 * export async function runListAsync(owners: TerminalOwners): Promise<void> {
 *   try {
 *     await owners.runAsync("example.chat/42", "ls", null, []);
 *   }
 *   catch (error) {
 *     console.log(error instanceof RunPartInactiveException);
 *   }
 * }
 * ```
 */
export declare class RunPartInactiveException extends TerminalRunRefusedException {
  /**
   * `"RunPartInactiveException"`.
   */
  public override readonly name: string;

  /**
   * `"context"`.
   */
  public override readonly parameter: string;

  /**
   * Creates the exception, whose message says that nothing ran or opened, since the terminal's window part isn't active in the window.
   *
   * @example
   * ```ts
   * import { RunPartInactiveException } from "@noldova/terminal/window";
   *
   * console.log(new RunPartInactiveException().message);
   * ```
   */
  public constructor();
}

/**
 * Thrown when {@link TerminalOwners.runAsync} or {@link TerminalOwners.startRunAsync} refuses one of its arguments, such as a blank owner, a
 * command with a control character or a relative folder, before anything opened or was typed.
 *
 * @example
 * ```ts
 * import { RunArgumentRefusedException, type TerminalOwners } from "@noldova/terminal/window";
 *
 * export async function runInRelativeFolderAsync(owners: TerminalOwners): Promise<void> {
 *   try {
 *     await owners.runAsync("example.chat/42", "ls", "work", []);
 *   }
 *   catch (error) {
 *     console.log(error instanceof RunArgumentRefusedException && error.parameter);
 *   }
 * }
 * ```
 */
export declare class RunArgumentRefusedException extends TerminalRunRefusedException {
  /**
   * `"RunArgumentRefusedException"`.
   */
  public override readonly name: string;

  /**
   * The refused field: `owner`, `command`, `folder`, a kind such as `shellKinds.1`, or `sessionId` or `whenBusy` for a target's refused field.
   */
  public override readonly parameter: string;

  /**
   * Why the field is refused, such as "Expected a string that is not blank."; it never holds the commands.
   */
  public readonly reason: string;

  /**
   * Creates the exception, whose message says that nothing ran or opened, and gives the reason.
   *
   * @param parameterName The refused field.
   * @param reason Why it is refused.
   *
   * @example
   * ```ts
   * import { RunArgumentRefusedException } from "@noldova/terminal/window";
   *
   * console.log(new RunArgumentRefusedException("owner", "Expected a string that is not blank.").message);
   * ```
   */
  public constructor(parameterName: string, reason: string);
}

/**
 * Thrown when {@link TerminalOwners.runAsync} or {@link TerminalOwners.startRunAsync} finds no installed shell of the run's kinds, so nothing
 * opened and nothing was typed, since a shell of another kind would read the commands differently.
 *
 * @example
 * ```ts
 * import { RunShellKindsMissingException, TerminalShellKind, type TerminalOwners } from "@noldova/terminal/window";
 *
 * export async function runInBashAsync(owners: TerminalOwners): Promise<void> {
 *   try {
 *     await owners.runAsync("example.chat/42", "ls", null, [TerminalShellKind.Bash, TerminalShellKind.Zsh]);
 *   }
 *   catch (error) {
 *     if (error instanceof RunShellKindsMissingException)
 *       console.log(error.message);
 *   }
 * }
 * ```
 */
export declare class RunShellKindsMissingException extends TerminalRunRefusedException {
  /**
   * `"RunShellKindsMissingException"`.
   */
  public override readonly name: string;

  /**
   * `"shellKinds"`.
   */
  public override readonly parameter: string;

  /**
   * The kinds of shell the run needs, none of which is installed.
   */
  public readonly shellKinds: readonly TerminalShellKind[];

  /**
   * Creates the exception, whose message names the kinds, such as "The commands weren't run, and nothing opened: no shell of the kinds they
   * need is installed (Bash or Zsh)."
   *
   * @param shellKinds The kinds of shell the run needs.
   *
   * @example
   * ```ts
   * import { RunShellKindsMissingException, TerminalShellKind } from "@noldova/terminal/window";
   *
   * console.log(new RunShellKindsMissingException([TerminalShellKind.Bash, TerminalShellKind.Zsh]).message);
   * ```
   */
  public constructor(shellKinds: readonly TerminalShellKind[]);
}

/**
 * Thrown by {@link TerminalOwners.readRunOutputAsync} when the number of lines isn't a whole number from 1 to
 * {@link TerminalOwners.maximumRunLines}, before anything is asked.
 *
 * @example
 * ```ts
 * import { RunLinesRefusedException, type TerminalOwners, type TerminalRun } from "@noldova/terminal/window";
 *
 * export async function readNoLinesAsync(owners: TerminalOwners, run: TerminalRun): Promise<void> {
 *   try {
 *     await owners.readRunOutputAsync(run, 0);
 *   }
 *   catch (error) {
 *     console.log(error instanceof RunLinesRefusedException && error.lines);
 *   }
 * }
 * ```
 */
export declare class RunLinesRefusedException extends TerminalWindowException {
  /**
   * `"RunLinesRefusedException"`.
   */
  public override readonly name: string;

  /**
   * The number of lines asked for.
   */
  public readonly lines: number;

  /**
   * The most lines a read takes.
   */
  public readonly maximum: number;

  /**
   * Creates the exception, whose message gives the range and the number asked for.
   *
   * @param lines The number of lines asked for.
   * @param maximum The most lines a read takes.
   *
   * @example
   * ```ts
   * import { RunLinesRefusedException, TerminalOwners } from "@noldova/terminal/window";
   *
   * console.log(new RunLinesRefusedException(0, TerminalOwners.maximumRunLines).message);
   * ```
   */
  public constructor(lines: number, maximum: number);
}

/**
 * Thrown by {@link TerminalOwners.runAsync} and {@link TerminalOwners.startRunAsync} when the runtime picked or opened a terminal, whose tab
 * shows, or was given one, but didn't type the commands into it. An app can log it by its name and reason, and the person may run the
 * commands again.
 *
 * @example
 * ```ts
 * import { TerminalRunNotTypedException, TerminalRunOutcome, type TerminalOwners } from "@noldova/terminal/window";
 *
 * export async function runTestsAsync(owners: TerminalOwners): Promise<void> {
 *   try {
 *     await owners.runAsync("example.chat/42", "npm test", null, []);
 *   }
 *   catch (error) {
 *     console.log(error instanceof TerminalRunNotTypedException && error.reason === TerminalRunOutcome.Input);
 *   }
 * }
 * ```
 */
export declare class TerminalRunNotTypedException extends TerminalWindowException {
  /**
   * `"TerminalRunNotTypedException"`.
   */
  public override readonly name: string;

  /**
   * The terminal's session, whose tab shows while the window shows its owner, unless the run had a target.
   */
  public readonly sessionId: string;

  /**
   * Why nothing was typed: `Input` when the person typed in the terminal after the run picked it, or its prompt line held text, `Tab` when the
   * commands hold a tab and the shell hasn't turned bracketed paste on, so it would take the tab as completion, or `Ended` when the terminal
   * ended, closed or restarted first, or `Busy` when a run's target was busy and stayed so, or another run into it was still starting. Never
   * `Typed`.
   */
  public readonly reason: TerminalRunOutcome;

  /**
   * Creates the exception, whose message names the terminal and why nothing was typed, and never holds the commands.
   *
   * @param sessionId The terminal's session.
   * @param reason Why nothing was typed.
   *
   * @example
   * ```ts
   * import { TerminalRunNotTypedException, TerminalRunOutcome } from "@noldova/terminal/window";
   *
   * console.log(new TerminalRunNotTypedException("session-1", TerminalRunOutcome.Busy).message);
   * ```
   */
  public constructor(sessionId: string, reason: TerminalRunOutcome);
}

/**
 * A run an app started with {@link TerminalOwners.startRunAsync}: the terminal its commands went into, the run's own id, which reads its
 * output, and its end.
 *
 * @example
 * ```ts
 * import type { TerminalOwners } from "@noldova/terminal/window";
 *
 * export async function runTestsAsync(owners: TerminalOwners): Promise<void> {
 *   const run = await owners.startRunAsync("example.chat/42", "npm test", null, [], null);
 *   const end = await run.ended;
 *   const output = await owners.readRunOutputAsync(run);
 *   console.log(run.sessionId, end.endedBy, end.exitCode, output.lines.length);
 * }
 * ```
 */
export declare class TerminalRun {
  /**
   * The session of the terminal the commands went into.
   */
  public readonly sessionId: string;

  /**
   * The run's id, which {@link TerminalOwners.readRunOutputAsync} reads the output by.
   */
  public readonly runId: string;

  /**
   * Resolves once, when the run's commands have ended, and never rejects; a later run into the same terminal doesn't change it.
   *
   * - `"Command"` when the shell marked the end of the run's last command, with that command's exit code, or `null` when the shell gave none,
   *   as bash doesn't for a subshell such as `(exit 3)`. A run of several lines ends with its last line's command. A Ctrl+C, from
   *   {@link TerminalRunBusy.Interrupt} or from the person, ends a command like any other, with the code the shell gives.
   * - `"NoIntegration"` when the shell has no integration to mark a command's end, such as Command Prompt, fish or WSL: it has already resolved
   *   when {@link TerminalOwners.startRunAsync} resolves, so a run in such a shell never looks running. A new terminal's shell that marked
   *   nothing within 10 seconds, such as one whose profile takes that long to load, counts as having none: the run is typed then and ends this
   *   way, though its commands may still run.
   * - `"TerminalEnded"` when the terminal's shell exited or restarted, the terminal closed, or the runtime started again, before the end.
   *
   * A run's `ended` has resolved before a later run this window starts into the same terminal resolves {@link TerminalOwners.startRunAsync},
   * whichever {@link TerminalRunBusy} it took, since the runtime ends a run still waiting before it types the next one; a run that waits with no
   * end mark, as for a command that goes on over several lines in a shell that takes no bracketed paste, such as macOS's bash 3.2, then ends as
   * `"Command"` with the last code the shell marked for it, or `null`.
   *
   * @example
   * ```ts
   * import type { TerminalOwners, TerminalRunTarget } from "@noldova/terminal/window";
   *
   * export async function logTestsEndAsync(owners: TerminalOwners, chat: { readonly id: string },
   *   target: TerminalRunTarget | null): Promise<void> {
   *   const run = await owners.startRunAsync(`example.chat/${chat.id}`, "npm test", null, [], target);
   *   const end = await run.ended;
   *   console.log(end.endedBy === "Command" ? `exited with ${end.exitCode}` : end.endedBy);
   * }
   * ```
   */
  public readonly ended: Promise<TerminalRunEnd>;

  /**
   * Creates the run, as {@link TerminalOwners.startRunAsync} does; an app keeps the one it is given.
   *
   * @param sessionId The terminal's session.
   * @param runId The run's id.
   * @param ended The run's end, for {@link TerminalRun.ended}; {@link TerminalOwners.startRunAsync} gives it, and a run made without one
   * resolves `"TerminalEnded"` at once.
   *
   * @example
   * ```ts
   * import { TerminalRun, TerminalRunEnd } from "@noldova/terminal/window";
   *
   * console.log(new TerminalRun("session-1", "run-1", Promise.resolve(new TerminalRunEnd("Command", 0))).runId);
   * ```
   */
  public constructor(sessionId: string, runId: string, ended?: Promise<TerminalRunEnd>);
}

/**
 * How a run's commands ended, which {@link TerminalRun.ended} gives.
 *
 * @example
 * ```ts
 * import type { TerminalRunEnd } from "@noldova/terminal/window";
 *
 * function describe(end: TerminalRunEnd): string {
 *   return end.endedBy === "Command" ? `exited with ${end.exitCode}` : end.endedBy;
 * }
 * ```
 */
export declare class TerminalRunEnd {
  /**
   * `"Command"` when the shell marked the end of the run's last command, `"NoIntegration"` when the shell has no integration to mark it, or
   * `"TerminalEnded"` when the terminal's shell exited or restarted, the terminal closed, or the runtime started again first.
   */
  public readonly endedBy: "Command" | "NoIntegration" | "TerminalEnded";

  /**
   * The last command's exit code, or `null` unless `endedBy` is `"Command"`, and for a command the shell gave no code.
   */
  public readonly exitCode: number | null;

  /**
   * Creates the end.
   *
   * @param endedBy How the run's commands ended.
   * @param exitCode The last command's exit code, or `null`.
   *
   * @example
   * ```ts
   * import { TerminalRunEnd } from "@noldova/terminal/window";
   *
   * console.log(new TerminalRunEnd("TerminalEnded", null).endedBy);
   * ```
   */
  public constructor(endedBy: "Command" | "NoIntegration" | "TerminalEnded", exitCode: number | null);
}

/**
 * The terminal a run goes into, a person's terminal of the run's owner, such as the one an app shows under the commands with
 * {@link EmbeddedTerminal}, and what the run does while that terminal's shell is busy.
 *
 * @example
 * ```ts
 * import { TerminalRunBusy, TerminalRunTarget, type TerminalOwners } from "@noldova/terminal/window";
 *
 * export async function runTestsInAsync(owners: TerminalOwners, sessionId: string): Promise<void> {
 *   const target = new TerminalRunTarget(sessionId, TerminalRunBusy.Interrupt);
 *   await owners.startRunAsync("example.chat/42", "npm test", null, [], target);
 * }
 * ```
 */
export declare class TerminalRunTarget {
  /**
   * The terminal's session.
   */
  public readonly sessionId: string;

  /**
   * What the run does while the terminal's shell is busy: `Refuse` types nothing, and `Interrupt` sends Ctrl+C to a command that starts within
   * two seconds and types once the shell is back at an empty prompt within two seconds more; either fails the run as `Busy` when it types
   * nothing.
   */
  public readonly whenBusy: TerminalRunBusy;

  /**
   * Creates the target.
   *
   * @param sessionId The terminal's session, which {@link TerminalOwners.startRunAsync} checks.
   * @param whenBusy What the run does while the shell is busy; `Refuse` when left out.
   *
   * @example
   * ```ts
   * import { TerminalRunBusy, TerminalRunTarget } from "@noldova/terminal/window";
   *
   * console.log(new TerminalRunTarget("session-1", TerminalRunBusy.Interrupt).whenBusy);
   * ```
   */
  public constructor(sessionId: string, whenBusy?: TerminalRunBusy);
}

/**
 * Thrown by {@link TerminalOwners.readRunOutputAsync} when the runtime can't give a run's output: its terminal never had the run or no
 * longer keeps it, its shell ended or restarted, or the runtime no longer has its terminal, such as after it started again.
 *
 * @example
 * ```ts
 * import { TerminalRunNotFoundException, type TerminalOwners, type TerminalRun } from "@noldova/terminal/window";
 *
 * export async function readOutputAsync(owners: TerminalOwners, run: TerminalRun): Promise<void> {
 *   try {
 *     await owners.readRunOutputAsync(run);
 *   }
 *   catch (error) {
 *     console.log(error instanceof TerminalRunNotFoundException && error.runId);
 *   }
 * }
 * ```
 */
export declare class TerminalRunNotFoundException extends TerminalWindowException {
  /**
   * `"TerminalRunNotFoundException"`.
   */
  public override readonly name: string;

  /**
   * The session of the run's terminal.
   */
  public readonly sessionId: string;

  /**
   * The run's id.
   */
  public readonly runId: string;

  /**
   * Creates the exception, whose message names the terminal and the run.
   *
   * @param sessionId The session of the run's terminal.
   * @param runId The run's id.
   *
   * @example
   * ```ts
   * import { TerminalRunNotFoundException } from "@noldova/terminal/window";
   *
   * console.log(new TerminalRunNotFoundException("session-1", "run-1").message);
   * ```
   */
  public constructor(sessionId: string, runId: string);
}

/**
 * What an app asks of a terminal it launches with {@link TerminalLauncher.openAsync}, which checks it.
 *
 * @example
 * ```ts
 * import { TerminalLaunch } from "@noldova/terminal/window";
 *
 * const launch = new TerminalLaunch("/work/project", { AGENT_HOME: "/work/agent" }, "Run `agent login` to sign in.", "Sign in");
 * ```
 */
export declare class TerminalLaunch {
  /**
   * The folder the shell starts in, an absolute path, or `null` for the app's {@link TerminalStartFolder}, else the home folder.
   */
  public readonly folder: string | null;

  /**
   * The variables laid over the shell's environment, by name.
   */
  public readonly environment: Readonly<Record<string, string>>;

  /**
   * The lines shown above the shell's first output, or `null` for none.
   */
  public readonly notice: string | null;

  /**
   * The tab's title, or `null` for the shell's name.
   */
  public readonly title: string | null;

  /**
   * The command typed into the shell and entered once the shell is ready, as if the person typed it, or `null` for none.
   */
  public readonly command: string | null;

  /**
   * Whether the terminal gets a tab in the Terminals panel; `false` for one the app shows only in its own page, with {@link EmbeddedTerminal.open}.
   */
  public readonly opensTab: boolean;

  /**
   * The rows the terminal's tab shows at least while the terminal is open, or `null` for none: as the tab first shows in the bottom dock, the
   * dock grows, as far as the window allows, until the terminal ends or closes, when the dock goes back to its size unless the person resized it
   * meanwhile. A tab in a side dock, whose growth would widen it, or among the documents grows nothing.
   */
  public readonly minimumRows: number | null;

  /**
   * The kinds of shell the terminal may run, or none for any: with kinds, it runs the Default shell setting's shell when that is of them, else the
   * runtime's default when it is, else the first installed shell of them, as {@link TerminalOwners.runAsync} picks one. An app whose program the
   * person installed on the host asks for the host's own shells, such as PowerShell and Command Prompt on Windows, so a WSL distribution set as
   * the Default shell doesn't run its sign-in.
   */
  public readonly shellKinds: readonly TerminalShellKind[];

  /**
   * Creates the launch, which {@link TerminalLauncher.openAsync} checks rather than the constructor.
   *
   * @param folder The starting folder: an absolute path of at most 4,096 UTF-16 code units, or `null` for the start folder.
   * @param environment The variables: at most 256, each with a portable name (a letter or `_`, then letters, digits or `_`) of at most 256
   * UTF-16 code units, none of `TERM`, `COLORTERM`, `ZDOTDIR` or a name starting with `NOLDOVA_TERMINAL_`, in any case, no two whose names
   * differ only in case, each value at most 32,767 UTF-16 code units without a null character, and at most 131,072 UTF-16 code units of names
   * and values in all; none when left out.
   * @param notice The notice: `null`, or not blank and at most 4,096 UTF-16 code units, whose line breaks start new lines; `null` when left out.
   * @param title The tab's title: `null`, or not blank and at most 200 UTF-16 code units; `null` when left out.
   * @param command The command: `null`, or one line, not blank, of at most 16,384 UTF-16 code units, with no line break, tab or other control
   * character, since the runtime enters it; `null` when left out. The runtime types it once the shell shows its first prompt, or, for a shell
   * without Terminal's integration, once its first output has settled for half a second, waiting at most 10 seconds either way; the shell
   * runs it as the person's own command, so the app passes only commands it means the person to run.
   * @param opensTab Whether the terminal gets a tab: `false` for a terminal the app shows only in its own page, by passing the launched
   * terminal's session to {@link EmbeddedTerminal.open}, so the person doesn't see it twice; it runs and ends as a tabbed one does, and the app
   * ends it with {@link LaunchedTerminal.closeAsync}. `true` when left out.
   * @param minimumRows The rows the tab shows at least: `null`, or a whole number from 1 to 100, for a program that draws more rows than a short
   * dock shows, such as a sign-in's list; `null` when left out, and `null` for a launch without a tab.
   * @param shellKinds The kinds of shell the terminal may run, each one of {@link TerminalShellKind}'s, or none for any; none when left out. With
   * none of them installed, {@link TerminalLauncher.openAsync} opens nothing and rejects with Noldova Desktop's request error, as for any
   * failure of the launch in the runtime, not with a {@link TerminalLaunchRefusedException}, since the runtime finds that out.
   *
   * @example
   * ```ts
   * import { TerminalLaunch } from "@noldova/terminal/window";
   *
   * console.log(new TerminalLaunch(null).environment);
   * ```
   */
  public constructor(folder: string | null, environment?: Readonly<Record<string, string>>, notice?: string | null, title?: string | null,
    command?: string | null, opensTab?: boolean, minimumRows?: number | null, shellKinds?: readonly TerminalShellKind[]);
}

/**
 * How a launched terminal's shell ended.
 *
 * @example
 * ```ts
 * import type { TerminalEnd } from "@noldova/terminal/window";
 *
 * function describe(end: TerminalEnd): string {
 *   return end.endedBy === "Exit" ? `exited with ${end.exitCode}` : end.endedBy;
 * }
 * ```
 */
export declare class TerminalEnd {
  /**
   * `"Exit"` when the shell exited by itself, `"Close"` when its terminal closed, or when a Restart ended its shell but couldn't start a new
   * one, or `"Detach"` when the window stopped hearing of it, since the runtime started again and opens no launched terminal again.
   */
  public readonly endedBy: "Exit" | "Close" | "Detach";

  /**
   * The shell's exit code, or `null` when it has none, as for a `"Detach"`.
   */
  public readonly exitCode: number | null;

  /**
   * Creates the end.
   *
   * @param endedBy How the shell ended.
   * @param exitCode The exit code, or `null`.
   *
   * @example
   * ```ts
   * import { TerminalEnd } from "@noldova/terminal/window";
   *
   * console.log(new TerminalEnd("Exit", 0).exitCode);
   * ```
   */
  public constructor(endedBy: "Exit" | "Close" | "Detach", exitCode: number | null);
}

/**
 * A terminal {@link TerminalLauncher.openAsync} opened.
 *
 * @example
 * ```ts
 * import type { IWindowPartContext } from "@noldova/desktop.window";
 * import { TerminalLaunch, TerminalLauncher } from "@noldova/terminal/window";
 *
 * export async function launchShellAsync(context: IWindowPartContext): Promise<void> {
 *   const launched = await TerminalLauncher.openAsync(context, new TerminalLaunch(null));
 *   console.log(launched.sessionId, (await launched.ended).endedBy);
 * }
 * ```
 */
export declare class LaunchedTerminal {
  /**
   * The terminal's session.
   */
  public readonly sessionId: string;

  /**
   * Resolves once, at the terminal's end, and never rejects. A Restart of a running shell doesn't end it, since the tab stays and the new
   * shell takes the same variables; a Restart after the shell exited starts it again, but `ended` has already resolved.
   */
  public readonly ended: Promise<TerminalEnd>;

  /**
   * Resolves once, when the launch's own command ({@link TerminalLaunch.command}) ends while the terminal stays open, with that command's exit
   * code, and never rejects; commands the person types after it don't count. It resolves `null` when the launch has no command, when the
   * terminal ends first, when the shell has no integration (Command Prompt, fish, WSL) or never took the command, when the person typed into the
   * terminal before the command went in, when a Restart comes first, or
   * when the shell gave no code or marked no end for it, as bash doesn't for a subshell such as `(exit 3)`.
   *
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import { TerminalLaunch, TerminalLauncher } from "@noldova/terminal/window";
   *
   * export async function signInAsync(context: IWindowPartContext): Promise<void> {
   *   const launched = await TerminalLauncher.openAsync(context, new TerminalLaunch(null, {}, null, "Sign in", "tool auth login"));
   *   if (await launched.commandEnded === 0)
   *     await launched.closeAsync();
   * }
   * ```
   */
  public readonly commandEnded: Promise<number | null>;

  /**
   * Creates the launched terminal.
   *
   * @param sessionId The terminal's session.
   * @param ended The terminal's end.
   * @param closeTabAsync Ends the terminal as closing its tab does, for {@link LaunchedTerminal.closeAsync}; {@link TerminalLauncher.openAsync} gives
   * it, and a terminal made without one closes nothing.
   * @param commandEnded The launch's command's exit code, for {@link LaunchedTerminal.commandEnded}; {@link TerminalLauncher.openAsync} gives it,
   * and a terminal made without one resolves `null` at its end.
   *
   * @example
   * ```ts
   * import { LaunchedTerminal, TerminalEnd } from "@noldova/terminal/window";
   *
   * console.log(new LaunchedTerminal("session-1", Promise.resolve(new TerminalEnd("Exit", 0))).sessionId);
   * ```
   */
  public constructor(sessionId: string, ended: Promise<TerminalEnd>, closeTabAsync?: () => Promise<void>, commandEnded?: Promise<number | null>);

  /**
   * Ends the terminal as closing its tab does: its tab, when it has one, closes and its shell ends, so {@link LaunchedTerminal.ended} resolves
   * `"Close"`, as when the app stops what the terminal was for. A terminal launched without a tab ends through the runtime alone.
   *
   * @returns A promise that resolves once any tab has closed and the runtime has ended the terminal; for a terminal that already ended, at once,
   * doing nothing; a close asked while one is under way is that close. A terminal the runtime no longer has, as when the person closed its
   * tab meanwhile, counts as closed. It rejects with what the runtime rejects with when it fails the close of a terminal it still has.
   *
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import { TerminalLaunch, TerminalLauncher } from "@noldova/terminal/window";
   *
   * export async function closeSignInAsync(context: IWindowPartContext): Promise<void> {
   *   const launched = await TerminalLauncher.openAsync(context, new TerminalLaunch(null, {}, null, "Sign in", "agent login"));
   *   await launched.closeAsync();
   *   console.log((await launched.ended).endedBy);
   * }
   * ```
   */
  public closeAsync(): Promise<void>;
}

/**
 * The base of the exceptions {@link TerminalLauncher.openAsync} throws when it refuses a launch, before anything opens, which a caller
 * catches to handle any refusal; each refusal is its own subclass.
 *
 * @example
 * ```ts
 * import type { IWindowPartContext } from "@noldova/desktop.window";
 * import { TerminalLaunch, TerminalLauncher, TerminalLaunchRefusedException } from "@noldova/terminal/window";
 *
 * export async function launchWithTermAsync(context: IWindowPartContext): Promise<void> {
 *   try {
 *     await TerminalLauncher.openAsync(context, new TerminalLaunch(null, { TERM: "dumb" }));
 *   }
 *   catch (error) {
 *     console.log(error instanceof TerminalLaunchRefusedException && error.parameter);
 *   }
 * }
 * ```
 */
export declare abstract class TerminalLaunchRefusedException extends TerminalWindowException {
  /**
   * `"TerminalLaunchRefusedException"`, which a subclass replaces with its own.
   */
  public override readonly name: string;

  /**
   * The refused field: `folder`, `environment`, a variable such as `environment.TERM`, `notice`, `title`, `command`, `minimumRows`, a kind
   * such as `shellKinds.0`, or `context` while the terminal's window part isn't active. The exception never carries a variable's value.
   */
  public abstract readonly parameter: string;

  /**
   * Creates the exception, for a subclass.
   *
   * @param message The message, which says that nothing opened, and why.
   * @param options The options, such as the error that caused this one.
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * Thrown by {@link TerminalLauncher.openAsync} while Terminal's window part isn't active in the window, before anything opens.
 *
 * @example
 * ```ts
 * import type { IWindowPartContext } from "@noldova/desktop.window";
 * import { LaunchPartInactiveException, TerminalLaunch, TerminalLauncher } from "@noldova/terminal/window";
 *
 * export async function launchInWorkAsync(context: IWindowPartContext): Promise<void> {
 *   try {
 *     await TerminalLauncher.openAsync(context, new TerminalLaunch("/work"));
 *   }
 *   catch (error) {
 *     console.log(error instanceof LaunchPartInactiveException);
 *   }
 * }
 * ```
 */
export declare class LaunchPartInactiveException extends TerminalLaunchRefusedException {
  /**
   * `"LaunchPartInactiveException"`.
   */
  public override readonly name: string;

  /**
   * `"context"`.
   */
  public override readonly parameter: string;

  /**
   * Creates the exception, whose message says that nothing opened, since the terminal's window part isn't active in the window.
   *
   * @example
   * ```ts
   * import { LaunchPartInactiveException } from "@noldova/terminal/window";
   *
   * console.log(new LaunchPartInactiveException().message);
   * ```
   */
  public constructor();
}

/**
 * Thrown by {@link TerminalLauncher.openAsync} when the launch's folder doesn't exist, which it never replaces with another, before anything
 * opens.
 *
 * @example
 * ```ts
 * import type { IWindowPartContext } from "@noldova/desktop.window";
 * import { LaunchFolderMissingException, TerminalLaunch, TerminalLauncher } from "@noldova/terminal/window";
 *
 * export async function launchInGoneFolderAsync(context: IWindowPartContext): Promise<void> {
 *   try {
 *     await TerminalLauncher.openAsync(context, new TerminalLaunch("/work/gone"));
 *   }
 *   catch (error) {
 *     console.log(error instanceof LaunchFolderMissingException && error.folder);
 *   }
 * }
 * ```
 */
export declare class LaunchFolderMissingException extends TerminalLaunchRefusedException {
  /**
   * `"LaunchFolderMissingException"`.
   */
  public override readonly name: string;

  /**
   * `"folder"`.
   */
  public override readonly parameter: string;

  /**
   * The folder that doesn't exist.
   */
  public readonly folder: string;

  /**
   * Creates the exception, whose message says that nothing opened and names the folder.
   *
   * @param folder The folder that doesn't exist.
   *
   * @example
   * ```ts
   * import { LaunchFolderMissingException } from "@noldova/terminal/window";
   *
   * console.log(new LaunchFolderMissingException("/work/gone").message);
   * ```
   */
  public constructor(folder: string);
}

/**
 * Thrown by {@link TerminalLauncher.openAsync} when the launch's title is blank or longer than its limit, before anything opens.
 *
 * @example
 * ```ts
 * import type { IWindowPartContext } from "@noldova/desktop.window";
 * import { LaunchTitleRefusedException, TerminalLaunch, TerminalLauncher } from "@noldova/terminal/window";
 *
 * export async function launchWithBlankTitleAsync(context: IWindowPartContext): Promise<void> {
 *   try {
 *     await TerminalLauncher.openAsync(context, new TerminalLaunch(null, {}, null, " "));
 *   }
 *   catch (error) {
 *     console.log(error instanceof LaunchTitleRefusedException && error.maximumLength);
 *   }
 * }
 * ```
 */
export declare class LaunchTitleRefusedException extends TerminalLaunchRefusedException {
  /**
   * `"LaunchTitleRefusedException"`.
   */
  public override readonly name: string;

  /**
   * `"title"`.
   */
  public override readonly parameter: string;

  /**
   * The most characters a title has, `200`.
   */
  public readonly maximumLength: number;

  /**
   * Creates the exception, whose message says that nothing opened and gives the title's rule.
   *
   * @param maximumLength The most characters a title has.
   *
   * @example
   * ```ts
   * import { LaunchTitleRefusedException } from "@noldova/terminal/window";
   *
   * console.log(new LaunchTitleRefusedException(200).message);
   * ```
   */
  public constructor(maximumLength: number);
}

/**
 * Thrown by {@link TerminalLauncher.openAsync} when the launch's minimum rows aren't a whole number from 1 to their limit, before anything
 * opens.
 *
 * @example
 * ```ts
 * import type { IWindowPartContext } from "@noldova/desktop.window";
 * import { LaunchRowsRefusedException, TerminalLaunch, TerminalLauncher } from "@noldova/terminal/window";
 *
 * export async function launchWithNoRowsAsync(context: IWindowPartContext): Promise<void> {
 *   try {
 *     await TerminalLauncher.openAsync(context, new TerminalLaunch(null, {}, null, null, null, true, 0));
 *   }
 *   catch (error) {
 *     console.log(error instanceof LaunchRowsRefusedException && error.maximum);
 *   }
 * }
 * ```
 */
export declare class LaunchRowsRefusedException extends TerminalLaunchRefusedException {
  /**
   * `"LaunchRowsRefusedException"`.
   */
  public override readonly name: string;

  /**
   * `"minimumRows"`.
   */
  public override readonly parameter: string;

  /**
   * The most minimum rows a launch asks for, `100`.
   */
  public readonly maximum: number;

  /**
   * Creates the exception, whose message says that nothing opened and gives the rows' range.
   *
   * @param maximum The most minimum rows a launch asks for.
   *
   * @example
   * ```ts
   * import { LaunchRowsRefusedException } from "@noldova/terminal/window";
   *
   * console.log(new LaunchRowsRefusedException(100).message);
   * ```
   */
  public constructor(maximum: number);
}

/**
 * Thrown by {@link TerminalLauncher.openAsync} when a launch without a tab asks for minimum rows, which only its tab takes; an embedded
 * terminal takes its rows from {@link EmbeddedTerminal.open}.
 *
 * @example
 * ```ts
 * import type { IWindowPartContext } from "@noldova/desktop.window";
 * import { LaunchRowsWithoutTabException, TerminalLaunch, TerminalLauncher } from "@noldova/terminal/window";
 *
 * export async function launchRowsWithoutTabAsync(context: IWindowPartContext): Promise<void> {
 *   try {
 *     await TerminalLauncher.openAsync(context, new TerminalLaunch(null, {}, null, null, null, false, 10));
 *   }
 *   catch (error) {
 *     console.log(error instanceof LaunchRowsWithoutTabException);
 *   }
 * }
 * ```
 */
export declare class LaunchRowsWithoutTabException extends TerminalLaunchRefusedException {
  /**
   * `"LaunchRowsWithoutTabException"`.
   */
  public override readonly name: string;

  /**
   * `"minimumRows"`.
   */
  public override readonly parameter: string;

  /**
   * Creates the exception, whose message says that nothing opened, since minimum rows need the launch's tab.
   *
   * @example
   * ```ts
   * import { LaunchRowsWithoutTabException } from "@noldova/terminal/window";
   *
   * console.log(new LaunchRowsWithoutTabException().message);
   * ```
   */
  public constructor();
}

/**
 * Thrown by {@link TerminalLauncher.openAsync} when it refuses one of the launch's fields under the rules of {@link TerminalLaunch}'s
 * constructor, such as a relative folder, a variable's name or the command, before anything opens.
 *
 * @example
 * ```ts
 * import type { IWindowPartContext } from "@noldova/desktop.window";
 * import { LaunchArgumentRefusedException, TerminalLaunch, TerminalLauncher } from "@noldova/terminal/window";
 *
 * export async function launchInRelativeFolderAsync(context: IWindowPartContext): Promise<void> {
 *   try {
 *     await TerminalLauncher.openAsync(context, new TerminalLaunch("work"));
 *   }
 *   catch (error) {
 *     console.log(error instanceof LaunchArgumentRefusedException && error.parameter);
 *   }
 * }
 * ```
 */
export declare class LaunchArgumentRefusedException extends TerminalLaunchRefusedException {
  /**
   * `"LaunchArgumentRefusedException"`.
   */
  public override readonly name: string;

  /**
   * The refused field: `folder`, `environment`, a variable such as `environment.TERM`, `notice`, `command`, or a kind such as `shellKinds.0`.
   */
  public override readonly parameter: string;

  /**
   * Why the field is refused, such as "Expected an absolute path."; it never holds a variable's value.
   */
  public readonly reason: string;

  /**
   * Creates the exception, whose message says that nothing opened, and gives the reason.
   *
   * @param parameterName The refused field.
   * @param reason Why it is refused.
   *
   * @example
   * ```ts
   * import { LaunchArgumentRefusedException } from "@noldova/terminal/window";
   *
   * console.log(new LaunchArgumentRefusedException("folder", "Expected an absolute path.").message);
   * ```
   */
  public constructor(parameterName: string, reason: string);
}

/**
 * Opens terminals for an app: a terminal with the app's variables laid over the shell's environment and its notice shown above the shell's
 * first output, in a tab like the person's own or, when the launch asks for no tab, only in the app's own page, that tells the app when its
 * shell ends.
 *
 * @remarks
 * Nothing runs without the person: the notice says what to run, and nothing is typed into the shell. A launched terminal has no owner, isn't
 * the panel's, and isn't kept for the next run. The variables lie over the environment the shell starts from, under the shell integration's
 * own; on Windows a variable replaces the one whose name matches in any case. Their values are never logged, saved or restored: the runtime
 * holds them in memory only while the terminal is open, so that a Restart from its tab starts the shell with them again. The title is the
 * tab's, and isn't stored either, so after a reload the tab shows the shell's name. A terminal launched without a tab has none in any window,
 * even after a reload, and ends when the window that launched it closes or reloads, or when the app's connection closes; the app closes it with
 * {@link LaunchedTerminal.closeAsync} once it no longer shows it.
 */
export declare class TerminalLauncher {
  /**
   * Launches a terminal and opens its tab, unless the launch asks for none.
   *
   * @param context The calling app part's context, which makes the request; the app's module depends on the terminal module.
   * @param request The launch.
   * @returns A promise of the launched terminal, once its tab has opened, or with no tab when the launch asks for none or Terminal's window
   * part stopped while the runtime launched it.
   * @throws {@link TerminalLaunchRefusedException} Before anything opens, when the launch breaks a rule of {@link TerminalLaunch}'s
   * constructor, its folder no longer exists, which it never replaces with another, or the terminal's window part isn't active; the promise
   * rejects with what the runtime rejects with when it fails the launch.
   *
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import { TerminalLaunch, TerminalLauncher } from "@noldova/terminal/window";
   *
   * export async function launchSignInAsync(context: IWindowPartContext): Promise<void> {
   *   const launched = await TerminalLauncher.openAsync(context, new TerminalLaunch("/work/project", { AGENT_HOME: "/work/agent" },
   *     "Run `agent login` to sign in.", "Sign in"));
   *   const end = await launched.ended;
   *   console.log(end.endedBy, end.exitCode);
   * }
   * ```
   */
  public static openAsync(context: IWindowPartContext, request: TerminalLaunch): Promise<LaunchedTerminal>;
}

/**
 * Thrown by {@link EmbeddedTerminal.open} and {@link EmbeddedTerminal.setMaximumRows} for rows that aren't a whole number from 1 to 1,000.
 *
 * @example
 * ```ts
 * import type { EnvironmentInjector } from "@angular/core";
 * import { EmbeddedRowsRefusedException, EmbeddedTerminal } from "@noldova/terminal/window";
 *
 * export function openWithNoRows(sessionId: string, environmentInjector: EnvironmentInjector): void {
 *   try {
 *     EmbeddedTerminal.open(sessionId, environmentInjector, 0);
 *   }
 *   catch (error) {
 *     console.log(error instanceof EmbeddedRowsRefusedException && error.rows);
 *   }
 * }
 * ```
 */
export declare class EmbeddedRowsRefusedException extends TerminalWindowException {
  /**
   * `"EmbeddedRowsRefusedException"`.
   */
  public override readonly name: string;

  /**
   * The rows asked for.
   */
  public readonly rows: number;

  /**
   * The fewest rows an embedded terminal takes, `1`.
   */
  public readonly minimum: number;

  /**
   * The most rows an embedded terminal takes, `1000`.
   */
  public readonly maximum: number;

  /**
   * Creates the exception, whose message gives the range and the rows asked for.
   *
   * @param rows The rows asked for.
   * @param minimum The fewest rows an embedded terminal takes.
   * @param maximum The most rows an embedded terminal takes.
   *
   * @example
   * ```ts
   * import { EmbeddedRowsRefusedException } from "@noldova/terminal/window";
   *
   * console.log(new EmbeddedRowsRefusedException(0, 1, 1000).message);
   * ```
   */
  public constructor(rows: number, minimum: number, maximum: number);
}

/**
 * Thrown by {@link EmbeddedTerminal.open} while Terminal's window part isn't active in the window.
 *
 * @example
 * ```ts
 * import type { EnvironmentInjector } from "@angular/core";
 * import { EmbeddedTerminal, TerminalNotActiveException } from "@noldova/terminal/window";
 *
 * export function openEmbedded(sessionId: string, environmentInjector: EnvironmentInjector): void {
 *   try {
 *     EmbeddedTerminal.open(sessionId, environmentInjector, 15);
 *   }
 *   catch (error) {
 *     console.log(error instanceof TerminalNotActiveException);
 *   }
 * }
 * ```
 */
export declare class TerminalNotActiveException extends TerminalWindowException {
  /**
   * `"TerminalNotActiveException"`.
   */
  public override readonly name: string;

  /**
   * Creates the exception, whose message says that Terminal isn't active in the window.
   *
   * @example
   * ```ts
   * import { TerminalNotActiveException } from "@noldova/terminal/window";
   *
   * console.log(new TerminalNotActiveException().message);
   * ```
   */
  public constructor();
}

/**
 * A live terminal session an app shows in its own page, such as under the code block whose commands ran in it: Terminal's own pane, with its
 * keys, links, look and snapshot, in an element the app places and may move between hosts without the session reopening.
 *
 * @remarks
 * Its shell gets the element's width in columns and the rows the app asks for, while the element is only as tall as the rows drawn so far,
 * from the screen's top to the cursor's row, up to those rows; past them its terminal scrolls. A shell has one size, so within a window the
 * session's shown pane the person focused last sizes it, else the shown pane opened last, the element or a terminal tab or panel of the
 * session, so the element opening leaves the size with a pane the person has focused until {@link EmbeddedTerminal.focus}; the others draw at that size,
 * clipped or with blank space, and the element shows the last rows drawn when more are drawn than it shows. It never takes the focus as it
 * opens. Disposing of it detaches it from the session, which stays open.
 */
export declare class EmbeddedTerminal {
  /**
   * The element the app places in its page.
   */
  public readonly element: HTMLElement;

  /**
   * The rows the element shows, from 1 up to the rows the app asked for, all of them while a full-screen program has the alternate screen.
   */
  public readonly rows: Signal<number>;

  /**
   * Whether a full-screen program, such as an editor or a pager, has the alternate screen.
   */
  public readonly isFullScreen: Signal<boolean>;

  /**
   * Whether the session's shell ended; the element then keeps its last screen and takes no typing.
   */
  public readonly hasEnded: Signal<boolean>;

  /**
   * A row's height in CSS pixels, 0 until the pane has shown; it follows the pane as it draws or resizes, such as when the font size changes.
   * The element is taller than its rows by its inset, so an app counts the rows its page has room for with this rather than the element's
   * height.
   *
   * @example
   * ```ts
   * import type { EmbeddedTerminal } from "@noldova/terminal/window";
   *
   * export function fitRows(embedded: EmbeddedTerminal, historyHeight: number): void {
   *   const height = embedded.rowHeight();
   *   if (height > 0)
   *     embedded.setMaximumRows(Math.max(1, Math.min(15, Math.floor(historyHeight / 2 / height))));
   * }
   * ```
   */
  public readonly rowHeight: Signal<number>;

  private constructor();

  /**
   * Opens a pane of the session in a new element, shown.
   *
   * @param sessionId The session, such as the one {@link TerminalOwners.runAsync} gives.
   * @param injector The app's environment injector, which gives the window's services, such as its clipboard.
   * @param maximumRows The rows the shell gets, a whole number from 1 to 1,000.
   * @returns The embedded terminal, whose element the app places.
   * @throws {@link TerminalNotActiveException} While Terminal's window part isn't active in the window.
   * @throws {@link EmbeddedRowsRefusedException} For rows outside 1 to 1,000, or not a whole number.
   *
   * @example
   * ```ts
   * import type { EnvironmentInjector } from "@angular/core";
   * import { EmbeddedTerminal } from "@noldova/terminal/window";
   *
   * export function showEmbedded(sessionId: string, environmentInjector: EnvironmentInjector, host: HTMLElement): EmbeddedTerminal {
   *   const embedded = EmbeddedTerminal.open(sessionId, environmentInjector, 15);
   *   host.append(embedded.element);
   *   embedded.focus();
   *   return embedded;
   * }
   * ```
   */
  public static open(sessionId: string, injector: EnvironmentInjector, maximumRows: number): EmbeddedTerminal;

  /**
   * Gives its shell other rows, such as when the app's page changes height; fewer rows than are drawn shrink the element, and its terminal
   * scrolls inside.
   *
   * @param rows The rows the shell gets, a whole number from 1 to 1,000.
   * @throws {@link EmbeddedRowsRefusedException} For rows outside 1 to 1,000, or not a whole number; the shell keeps its rows.
   *
   * @example
   * ```ts
   * import type { EmbeddedTerminal } from "@noldova/terminal/window";
   *
   * export function fitToHistory(embedded: EmbeddedTerminal, historyRows: number): void {
   *   embedded.setMaximumRows(Math.min(15, Math.floor(historyRows / 2)));
   * }
   * ```
   */
  public setMaximumRows(rows: number): void;

  /**
   * Stops or starts its drawing, such as while the app keeps the element out of its page; a hidden element leaves sizing the shell to another
   * shown pane of the session, while one taken out of the page and not hidden still counts as shown.
   *
   * @param shown Whether it draws.
   *
   * @example
   * ```ts
   * import type { EmbeddedTerminal } from "@noldova/terminal/window";
   *
   * export function followPageVisibility(embedded: EmbeddedTerminal): void {
   *   embedded.setShown(!document.hidden);
   * }
   * ```
   */
  public setShown(shown: boolean): void;

  /**
   * Moves the focus into its terminal, so the person's keys reach the shell; one hidden or still loading takes it once it shows with its
   * terminal.
   *
   * @example
   * ```ts
   * import type { EmbeddedTerminal } from "@noldova/terminal/window";
   *
   * export function focusOnRun(embedded: EmbeddedTerminal, runButton: HTMLButtonElement): void {
   *   runButton.addEventListener("click", () => embedded.focus());
   * }
   * ```
   */
  public focus(): void;

  /**
   * Detaches it from the session, which stays open, and removes its element from the page.
   *
   * @example
   * ```ts
   * import type { EmbeddedTerminal } from "@noldova/terminal/window";
   *
   * export function removeEmbedded(embedded: EmbeddedTerminal): void {
   *   embedded.dispose();
   * }
   * ```
   */
  public dispose(): void;
}
