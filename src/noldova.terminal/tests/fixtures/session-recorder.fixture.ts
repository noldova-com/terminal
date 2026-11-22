/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalCommandEnded, TerminalCwd, TerminalExited, TerminalOutput, TerminalPaneReference, TerminalReference, TerminalTitle } from "@noldova/terminal.protocol";

import type { ITerminalSessionListener } from "../../src/interfaces/i-terminal-session-listener.ts";

export class SessionRecorder implements ITerminalSessionListener {
  public readonly outputs: TerminalOutput[] = [];
  public readonly exits: TerminalExited[] = [];
  public readonly titles: TerminalTitle[] = [];
  public readonly cwds: TerminalCwd[] = [];
  public readonly commandEnds: TerminalCommandEnded[] = [];
  public readonly promptStarts: TerminalReference[] = [];
  public readonly commands: string[] = [];
  public readonly detached: TerminalPaneReference[] = [];
  public readonly failures: string[] = [];
  public readonly unaskedResizes: string[] = [];
  private readonly failureWaiters: ((message: string) => void)[] = [];

  public get text(): string {
    return this.outputs.map(t => t.data).join("");
  }

  public onOutput(output: TerminalOutput): void {
    this.outputs.push(output);
  }

  public onExited(exited: TerminalExited): void {
    this.exits.push(exited);
  }

  public onTitleChanged(title: TerminalTitle): void {
    this.titles.push(title);
  }

  public onCwdChanged(cwd: TerminalCwd): void {
    this.cwds.push(cwd);
  }

  public onCommandEnded(ended: TerminalCommandEnded): void {
    this.commandEnds.push(ended);
  }

  public onPromptStarted(reference: TerminalReference): void {
    this.promptStarts.push(reference);
  }

  public onCommandStarted(command: string): void {
    this.commands.push(command);
  }

  public onDetached(pane: TerminalPaneReference): void {
    this.detached.push(pane);
  }

  public onFailed(sessionId: string, message: string): void {
    const failure: string = `${sessionId}: ${message}`;
    this.failures.push(failure);
    for (const waiter of this.failureWaiters.splice(0))
      waiter(failure);
  }

  public onResizeUnasked(sessionId: string): void {
    this.unaskedResizes.push(sessionId);
  }

  public nextFailureAsync(): Promise<string> {
    return new Promise<string>(resolve => this.failureWaiters.push(resolve));
  }
}
