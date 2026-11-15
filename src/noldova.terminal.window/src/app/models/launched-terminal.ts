/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalEnd } from "./terminal-end.ts";

export class LaunchedTerminal {
  private readonly closeTabAsync: () => Promise<void>;
  private hasEnded: boolean = false;
  private closing: Promise<void> | null = null;

  public readonly sessionId: string;
  public readonly ended: Promise<TerminalEnd>;
  public readonly commandEnded: Promise<number | null>;

  public constructor(sessionId: string, ended: Promise<TerminalEnd>, closeTabAsync: () => Promise<void> = () => Promise.resolve(),
    commandEnded: Promise<number | null> = ended.then(() => null)) {
    this.sessionId = sessionId;
    this.ended = ended;
    this.commandEnded = commandEnded;
    this.closeTabAsync = closeTabAsync;
    void ended.then(() => {
      this.hasEnded = true;
    });
  }

  public closeAsync(): Promise<void> {
    if (this.hasEnded)
      return Promise.resolve();
    this.closing ??= this.closeTabAsync();
    return this.closing;
  }
}
