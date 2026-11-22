/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalCommandEnded, TerminalCwd, TerminalExited, TerminalOutput, TerminalPaneReference, TerminalReference, TerminalTitle } from "@noldova/terminal.protocol";

export interface ITerminalSessionListener {
  onOutput(output: TerminalOutput): void;

  onExited(exited: TerminalExited): void;

  onTitleChanged(title: TerminalTitle): void;

  onCwdChanged(cwd: TerminalCwd): void;

  onCommandEnded(ended: TerminalCommandEnded): void;

  onPromptStarted(reference: TerminalReference): void;

  onCommandStarted(command: string): void;

  onDetached(pane: TerminalPaneReference): void;

  onFailed(sessionId: string, message: string): void;

  onResizeUnasked(sessionId: string): void;
}
