/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The terminal module's window part, which comes from its own package, `@noldova/terminal.window`, that this package pins exactly.
 *
 * @example
 * ```ts
 * import { windowPart } from "@noldova/terminal/window";
 *
 * console.log(windowPart.moduleId);
 * ```
 */
export { windowPart } from "@noldova/terminal.window";

/**
 * The folder an app starts new terminals in, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import type { IWindowPartContext } from "@noldova/desktop.window";
 * import { TerminalStartFolder } from "@noldova/terminal/window";
 *
 * export function provideProjectFolder(context: IWindowPartContext): () => void {
 *   const unregister: () => void = TerminalStartFolder.provide(context, () => "/work/project");
 *   return unregister;
 * }
 * ```
 */
export { TerminalStartFolder } from "@noldova/terminal.window";

/**
 * The base of every exception the window part throws, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { TerminalNotActiveException, TerminalWindowException } from "@noldova/terminal/window";
 *
 * console.log(new TerminalNotActiveException() instanceof TerminalWindowException);
 * ```
 */
export { TerminalWindowException } from "@noldova/terminal.window";

/**
 * Thrown when a window that already has a start folder provider is given another, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { StartFolderProvidedException } from "@noldova/terminal/window";
 *
 * console.log(new StartFolderProvidedException().name);
 * ```
 */
export { StartFolderProvidedException } from "@noldova/terminal.window";

/**
 * What an app ties a window's terminals to, such as its chats, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import type { IWindowPartContext } from "@noldova/desktop.window";
 * import { TerminalOwners } from "@noldova/terminal/window";
 *
 * export function provideChatOwners(context: IWindowPartContext): TerminalOwners {
 *   const owners = TerminalOwners.provide(context, () => "example.chat/42");
 *   return owners;
 * }
 * ```
 */
export { TerminalOwners } from "@noldova/terminal.window";

/**
 * Thrown when a window that already has an owners provider is given another, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { OwnersProvidedException } from "@noldova/terminal/window";
 *
 * console.log(new OwnersProvidedException().name);
 * ```
 */
export { OwnersProvidedException } from "@noldova/terminal.window";

/**
 * The base of every refusal of a run of an app's commands, before anything opens or is typed, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { RunPartInactiveException, TerminalRunRefusedException } from "@noldova/terminal/window";
 *
 * console.log(new RunPartInactiveException() instanceof TerminalRunRefusedException);
 * ```
 */
export { TerminalRunRefusedException } from "@noldova/terminal.window";

/**
 * Thrown when a run is refused because Terminal's window part isn't active in the window, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { RunPartInactiveException } from "@noldova/terminal/window";
 *
 * console.log(new RunPartInactiveException().message);
 * ```
 */
export { RunPartInactiveException } from "@noldova/terminal.window";

/**
 * Thrown when a run is refused for one of its arguments, naming the parameter and why, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { RunArgumentRefusedException } from "@noldova/terminal/window";
 *
 * console.log(new RunArgumentRefusedException("owner", "Expected a string that is not blank.").parameter);
 * ```
 */
export { RunArgumentRefusedException } from "@noldova/terminal.window";

/**
 * Thrown when a run is refused because no installed shell is of the kinds it takes, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { RunShellKindsMissingException, TerminalShellKind } from "@noldova/terminal/window";
 *
 * console.log(new RunShellKindsMissingException([TerminalShellKind.Bash, TerminalShellKind.Zsh]).message);
 * ```
 */
export { RunShellKindsMissingException } from "@noldova/terminal.window";

/**
 * Thrown when the number of a run's output lines asked for isn't a whole number in its range, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { RunLinesRefusedException, TerminalOwners } from "@noldova/terminal/window";
 *
 * console.log(new RunLinesRefusedException(0, TerminalOwners.maximumRunLines).lines);
 * ```
 */
export { RunLinesRefusedException } from "@noldova/terminal.window";

/**
 * Thrown when a run picked, opened or was given a terminal but its commands weren't typed, saying why, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { TerminalRunNotTypedException, TerminalRunOutcome } from "@noldova/terminal/window";
 *
 * console.log(new TerminalRunNotTypedException("session-1", TerminalRunOutcome.Input).reason);
 * ```
 */
export { TerminalRunNotTypedException } from "@noldova/terminal.window";

/**
 * What became of a run's commands: `Typed`, `Input`, `Tab`, `Ended`, `NoShell` or `Busy`, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { TerminalRunOutcome } from "@noldova/terminal/window";
 *
 * console.log(TerminalRunOutcome.Tab);
 * ```
 */
export { TerminalRunOutcome } from "@noldova/terminal.window";

/**
 * A run an app started: the terminal its commands went into and the run's id, which reads its output, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { TerminalRun } from "@noldova/terminal/window";
 *
 * console.log(new TerminalRun("session-1", "run-1").runId);
 * ```
 */
export { TerminalRun } from "@noldova/terminal.window";

/**
 * How a run's commands ended, which a run's `ended` gives, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { TerminalRunEnd } from "@noldova/terminal/window";
 *
 * console.log(new TerminalRunEnd("Command", 0).exitCode);
 * ```
 */
export { TerminalRunEnd } from "@noldova/terminal.window";

/**
 * The terminal a run goes into, and what the run does while its shell is busy, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { TerminalRunBusy, TerminalRunTarget } from "@noldova/terminal/window";
 *
 * console.log(new TerminalRunTarget("session-1", TerminalRunBusy.Interrupt).whenBusy);
 * ```
 */
export { TerminalRunTarget } from "@noldova/terminal.window";

/**
 * What a run into a given terminal does while its shell is busy: `Refuse` or `Interrupt`, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { TerminalRunBusy } from "@noldova/terminal/window";
 *
 * console.log(TerminalRunBusy.Refuse);
 * ```
 */
export { TerminalRunBusy } from "@noldova/terminal.window";

/**
 * Thrown when the runtime can't give a run's output, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { TerminalRunNotFoundException } from "@noldova/terminal/window";
 *
 * console.log(new TerminalRunNotFoundException("session-1", "run-1").sessionId);
 * ```
 */
export { TerminalRunNotFoundException } from "@noldova/terminal.window";

/**
 * A run's output with its colors: its last lines, and how many earlier ones were cut, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { TerminalRunOutput } from "@noldova/terminal/window";
 *
 * console.log(new TerminalRunOutput([], 0).cutLines);
 * ```
 */
export { TerminalRunOutput } from "@noldova/terminal.window";

/**
 * A line of a run's output: its text, whether it continues the line before, and its runs of color and style, from
 * `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { TerminalLine } from "@noldova/terminal/window";
 *
 * console.log(new TerminalLine("", false, []).isWrapped);
 * ```
 */
export { TerminalLine } from "@noldova/terminal.window";

/**
 * A run of a line's text in one color and style, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { TerminalOwners, TerminalTextRun } from "@noldova/terminal/window";
 *
 * console.log(new TerminalTextRun(2, TerminalOwners.rgbColor + 0xff8800, TerminalOwners.defaultColor, 0).foreground);
 * ```
 */
export { TerminalTextRun } from "@noldova/terminal.window";

/**
 * The style flags of a line's text run, whose sum is the run's style, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { TerminalTextStyle } from "@noldova/terminal/window";
 *
 * console.log(TerminalTextStyle.Bold + TerminalTextStyle.Underline);
 * ```
 */
export { TerminalTextStyle } from "@noldova/terminal.window";

/**
 * The kinds of shell a run of an app's commands can ask for, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { TerminalShellKind } from "@noldova/terminal/window";
 *
 * console.log([TerminalShellKind.Bash, TerminalShellKind.Zsh]);
 * ```
 */
export { TerminalShellKind } from "@noldova/terminal.window";

/**
 * Opens terminals for an app, with its variables and a notice, and tells it when their shells end, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import type { IWindowPartContext } from "@noldova/desktop.window";
 * import { TerminalLaunch, TerminalLauncher, type LaunchedTerminal } from "@noldova/terminal/window";
 *
 * export async function launchAgentAsync(context: IWindowPartContext): Promise<LaunchedTerminal> {
 *   const launched = await TerminalLauncher.openAsync(context, new TerminalLaunch("/work/project", { AGENT_HOME: "/work/agent" }));
 *   return launched;
 * }
 * ```
 */
export { TerminalLauncher } from "@noldova/terminal.window";

/**
 * What an app asks of a terminal it launches, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { TerminalLaunch } from "@noldova/terminal/window";
 *
 * console.log(new TerminalLaunch(null).folder);
 * ```
 */
export { TerminalLaunch } from "@noldova/terminal.window";

/**
 * A terminal the launcher opened, with the promise of its end, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { LaunchedTerminal, TerminalEnd } from "@noldova/terminal/window";
 *
 * console.log(new LaunchedTerminal("session-1", Promise.resolve(new TerminalEnd("Exit", 0))).sessionId);
 * ```
 */
export { LaunchedTerminal } from "@noldova/terminal.window";

/**
 * How a launched terminal's shell ended, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { TerminalEnd } from "@noldova/terminal/window";
 *
 * console.log(new TerminalEnd("Close", null).endedBy);
 * ```
 */
export { TerminalEnd } from "@noldova/terminal.window";

/**
 * The base of every refusal of a launch by the launcher, before anything opens, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { LaunchPartInactiveException, TerminalLaunchRefusedException } from "@noldova/terminal/window";
 *
 * console.log(new LaunchPartInactiveException() instanceof TerminalLaunchRefusedException);
 * ```
 */
export { TerminalLaunchRefusedException } from "@noldova/terminal.window";

/**
 * Thrown when a launch is refused because Terminal's window part isn't active in the window, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { LaunchPartInactiveException } from "@noldova/terminal/window";
 *
 * console.log(new LaunchPartInactiveException().message);
 * ```
 */
export { LaunchPartInactiveException } from "@noldova/terminal.window";

/**
 * Thrown when a launch is refused because its folder doesn't exist, naming the folder, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { LaunchFolderMissingException } from "@noldova/terminal/window";
 *
 * console.log(new LaunchFolderMissingException("/work/gone").folder);
 * ```
 */
export { LaunchFolderMissingException } from "@noldova/terminal.window";

/**
 * Thrown when a launch is refused because its title is longer than the limit, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { LaunchTitleRefusedException } from "@noldova/terminal/window";
 *
 * console.log(new LaunchTitleRefusedException(200).maximumLength);
 * ```
 */
export { LaunchTitleRefusedException } from "@noldova/terminal.window";

/**
 * Thrown when a launch is refused because it asks for more minimum rows than the most, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { LaunchRowsRefusedException } from "@noldova/terminal/window";
 *
 * console.log(new LaunchRowsRefusedException(100).maximum);
 * ```
 */
export { LaunchRowsRefusedException } from "@noldova/terminal.window";

/**
 * Thrown when a launch is refused because it asks for minimum rows without opening a tab, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { LaunchRowsWithoutTabException } from "@noldova/terminal/window";
 *
 * console.log(new LaunchRowsWithoutTabException().message);
 * ```
 */
export { LaunchRowsWithoutTabException } from "@noldova/terminal.window";

/**
 * Thrown when a launch is refused for one of its arguments, naming the parameter and why, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { LaunchArgumentRefusedException } from "@noldova/terminal/window";
 *
 * console.log(new LaunchArgumentRefusedException("folder", "Expected an absolute path.").parameter);
 * ```
 */
export { LaunchArgumentRefusedException } from "@noldova/terminal.window";

/**
 * A live terminal session an app shows in its own page, Terminal's own pane in an element the app places, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import type { EnvironmentInjector } from "@angular/core";
 * import { EmbeddedTerminal } from "@noldova/terminal/window";
 *
 * export function showEmbedded(sessionId: string, environmentInjector: EnvironmentInjector, host: HTMLElement): void {
 *   host.append(EmbeddedTerminal.open(sessionId, environmentInjector, 15).element);
 * }
 * ```
 */
export { EmbeddedTerminal } from "@noldova/terminal.window";

/**
 * Thrown when an embedded terminal is asked for rows that aren't a whole number in its range, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { EmbeddedRowsRefusedException } from "@noldova/terminal/window";
 *
 * console.log(new EmbeddedRowsRefusedException(0, 1, 1000).rows);
 * ```
 */
export { EmbeddedRowsRefusedException } from "@noldova/terminal.window";

/**
 * Thrown when Terminal's window part isn't active in the window, from `@noldova/terminal.window`.
 *
 * @example
 * ```ts
 * import { TerminalNotActiveException } from "@noldova/terminal/window";
 *
 * console.log(new TerminalNotActiveException().name);
 * ```
 */
export { TerminalNotActiveException } from "@noldova/terminal.window";
