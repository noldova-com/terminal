/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPart } from "@noldova/desktop.window";

import { TerminalWindowPart } from "../app/services/terminal-window-part.ts";

export { TerminalLine, TerminalRunBusy, TerminalRunOutcome, TerminalRunOutput, TerminalShellKind, TerminalTextRun, TerminalTextStyle } from "@noldova/terminal.protocol";

export { EmbeddedRowsRefusedException } from "../app/exceptions/embedded-rows-refused.exception.ts";
export { LaunchArgumentRefusedException } from "../app/exceptions/launch-argument-refused.exception.ts";
export { LaunchFolderMissingException } from "../app/exceptions/launch-folder-missing.exception.ts";
export { LaunchPartInactiveException } from "../app/exceptions/launch-part-inactive.exception.ts";
export { LaunchRowsRefusedException } from "../app/exceptions/launch-rows-refused.exception.ts";
export { LaunchRowsWithoutTabException } from "../app/exceptions/launch-rows-without-tab.exception.ts";
export { LaunchTitleRefusedException } from "../app/exceptions/launch-title-refused.exception.ts";
export { OwnersProvidedException } from "../app/exceptions/owners-provided.exception.ts";
export { RunArgumentRefusedException } from "../app/exceptions/run-argument-refused.exception.ts";
export { RunLinesRefusedException } from "../app/exceptions/run-lines-refused.exception.ts";
export { RunPartInactiveException } from "../app/exceptions/run-part-inactive.exception.ts";
export { RunShellKindsMissingException } from "../app/exceptions/run-shell-kinds-missing.exception.ts";
export { StartFolderProvidedException } from "../app/exceptions/start-folder-provided.exception.ts";
export { TerminalLaunchRefusedException } from "../app/exceptions/terminal-launch-refused.exception.ts";
export { TerminalNotActiveException } from "../app/exceptions/terminal-not-active.exception.ts";
export { TerminalRunNotFoundException } from "../app/exceptions/terminal-run-not-found.exception.ts";
export { TerminalRunNotTypedException } from "../app/exceptions/terminal-run-not-typed.exception.ts";
export { TerminalRunRefusedException } from "../app/exceptions/terminal-run-refused.exception.ts";
export { TerminalWindowException } from "../app/exceptions/terminal-window.exception.ts";
export { LaunchedTerminal } from "../app/models/launched-terminal.ts";
export { TerminalEnd } from "../app/models/terminal-end.ts";
export { TerminalLaunch } from "../app/models/terminal-launch.ts";
export { TerminalRun } from "../app/models/terminal-run.ts";
export { TerminalRunEnd } from "../app/models/terminal-run-end.ts";
export { TerminalRunTarget } from "../app/models/terminal-run-target.ts";
export { EmbeddedTerminal } from "../app/services/embedded-terminal.ts";
export { TerminalLauncher } from "../app/services/terminal-launcher.ts";
export { TerminalOwners } from "../app/services/terminal-owners.ts";
export { TerminalStartFolder } from "../app/services/terminal-start-folder.ts";

export const windowPart: IWindowPart = new TerminalWindowPart();
