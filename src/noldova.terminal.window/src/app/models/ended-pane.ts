/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalSize } from "@noldova/terminal.protocol";
import type { Terminal } from "@xterm/xterm";

export class EndedPane {
  private readonly terminal: Terminal;

  public readonly text: string;

  public constructor(text: string, terminal: Terminal) {
    this.text = text;
    this.terminal = terminal;
  }

  public get size(): TerminalSize {
    return new TerminalSize(this.terminal.cols, this.terminal.rows);
  }
}
