/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalAttachment, TerminalExit, TerminalInputEdge, TerminalLineRange } from "@noldova/terminal.protocol";

export interface ITerminalSink {
  drawAsync(attachment: TerminalAttachment): Promise<void>;
  write(data: string, written: () => void): void;
  markInput(edge: TerminalInputEdge): void;
  addCommand(command: string): void;
  follow(stored: TerminalLineRange): void;
  showTitle(title: string): void;
  showCwd(cwd: string): void;
  showExit(exit: TerminalExit): void;
  showRunning(): void;
  showLost(): void;
}
