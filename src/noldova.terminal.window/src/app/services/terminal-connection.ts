/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { TerminalAckParams, TerminalAttachment, TerminalCommandAdded, TerminalCwd, TerminalExited, TerminalInputParams, TerminalLinePage, TerminalLinesParams, TerminalNames, TerminalOutput, TerminalPaneReference, TerminalReference, TerminalResizeParams, TerminalTitle, TerminalVisibilityParams, type TerminalExit, type TerminalSize } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";
import type { ITerminalSink } from "../interfaces/i-terminal-sink.ts";
import { TerminalRuntimeClient } from "./terminal-runtime-client.ts";

export class TerminalConnection {
  private static readonly opened: Set<TerminalConnection> = new Set<TerminalConnection>();
  private readonly context: IWindowPartContext;
  private readonly sessionId: string;
  private readonly paneId: string;
  private readonly sink: ITerminalSink;
  private readonly unsubscribes: (() => void)[] = [];
  private buffered: TerminalOutput[] | null = null;
  private addedCommands: string[] | null = null;
  private heldExit: TerminalExit | null = null;
  private isRunningHeld: boolean = false;
  private expected: number = 0;
  private attempt: number = 0;
  private refreshing: number | null = null;
  private isAttached: boolean = false;
  private isVisible: boolean = false;
  private hasClosed: boolean = false;
  private isDetachSent: boolean = false;
  private goneAttempt: number | null = null;

  public constructor(context: IWindowPartContext, sessionId: string, paneId: string, sink: ITerminalSink) {
    this.context = context;
    this.sessionId = sessionId;
    this.paneId = paneId;
    this.sink = sink;
  }

  public get isClosed(): boolean {
    return this.hasClosed;
  }

  public static reattachAll(): void {
    for (const connection of TerminalConnection.opened)
      connection.reattach();
  }

  public async openAsync(): Promise<void> {
    TerminalConnection.opened.add(this);
    this.listen(TerminalNames.outputEvent, t => this.accept(TerminalOutput.fromJson(t)));
    this.listen(TerminalNames.exitedEvent, t => this.showExit(TerminalExited.fromJson(t)));
    this.listen(TerminalNames.restartedEvent, t => this.showRunning(TerminalReference.fromJson(t)));
    this.listen(TerminalNames.titleChangedEvent, t => this.showTitle(TerminalTitle.fromJson(t)));
    this.listen(TerminalNames.cwdChangedEvent, t => this.showCwd(TerminalCwd.fromJson(t)));
    this.listen(TerminalNames.detachedEvent, t => this.detach(TerminalPaneReference.fromJson(t)));
    this.listen(TerminalNames.commandAddedEvent, t => this.addCommand(TerminalCommandAdded.fromJson(t)));
    await this.attachAsync();
  }

  public setVisible(isVisible: boolean): void {
    if (this.hasClosed || isVisible === this.isVisible)
      return;
    this.isVisible = isVisible;
    if (this.isAttached) {
      if (!this.isGone())
        this.send(TerminalNames.visibilityMethod, new TerminalVisibilityParams(this.sessionId, this.paneId, isVisible).toJson());
    }
    else if (isVisible && this.buffered === null)
      void this.attachAsync();
  }

  public input(data: string): void {
    if (!this.hasClosed && !this.isGone() && data.length > 0)
      this.send(TerminalNames.inputMethod, new TerminalInputParams(this.sessionId, data).toJson());
  }

  public resize(size: TerminalSize): void {
    if (this.isSending())
      this.send(TerminalNames.resizeMethod, new TerminalResizeParams(this.sessionId, size).toJson());
  }

  public async refreshAsync(): Promise<void> {
    if (this.hasClosed)
      return;
    const isAttached: boolean = this.isAttached;
    const attaching: Promise<void> = this.attachAsync();
    this.refreshing = isAttached ? this.attempt : null;
    try {
      await attaching;
    }
    finally {
      this.refreshing = null;
    }
  }

  public async readLinesAsync(start: number, limit: number): Promise<TerminalLinePage> {
    return TerminalLinePage.fromJson(await this.context.requestAsync(TerminalNames.linesMethod, new TerminalLinesParams(this.sessionId, start, limit).toJson()));
  }

  public close(): void {
    if (this.hasClosed)
      return;
    this.hasClosed = true;
    TerminalConnection.opened.delete(this);
    for (const unsubscribe of this.unsubscribes.splice(0))
      unsubscribe();
    if (this.isSending())
      this.sendDetach();
    this.isAttached = false;
    this.refreshing = null;
    this.buffered = null;
  }

  private async attachAsync(): Promise<void> {
    const attempt: number = ++this.attempt;
    this.isAttached = false;
    const buffered: TerminalOutput[] = [];
    this.buffered = buffered;
    const addedCommands: string[] = [];
    this.addedCommands = addedCommands;
    this.heldExit = null;
    this.isRunningHeld = false;
    let attachment: TerminalAttachment;
    try {
      attachment = TerminalAttachment.fromJson(await this.context.requestAsync(TerminalNames.attachMethod, new TerminalPaneReference(this.sessionId, this.paneId).toJson()));
    }
    catch (error) {
      this.context.log(Resources.formatRequestFailed(TerminalNames.attachMethod, error));
      this.lose(attempt, TerminalRuntimeClient.isNotFound(error));
      return;
    }
    if (attempt !== this.attempt || this.hasClosed) {
      this.detachClosed(attempt);
      return;
    }

    try {
      await this.sink.drawAsync(attachment);
    }
    catch (error) {
      this.context.log(Resources.formatDrawFailed(error));
      this.lose(attempt);
      return;
    }
    if (attempt !== this.attempt || this.hasClosed) {
      this.detachClosed(attempt);
      return;
    }

    this.buffered = null;
    this.addedCommands = null;
    for (const command of addedCommands)
      this.sink.addCommand(command);
    this.sink.showTitle(attachment.title);
    if (attachment.cwd !== null)
      this.sink.showCwd(attachment.cwd);
    if (attachment.exit !== null)
      this.sink.showExit(attachment.exit);
    if (this.heldExit !== null)
      this.sink.showExit(this.heldExit);
    else if (this.isRunningHeld)
      this.sink.showRunning();
    this.heldExit = null;
    this.isRunningHeld = false;
    this.expected = attachment.offset;
    this.isAttached = true;
    this.send(TerminalNames.visibilityMethod, new TerminalVisibilityParams(this.sessionId, this.paneId, this.isVisible).toJson());
    for (const output of buffered)
      this.accept(output);
  }

  private lose(attempt: number, isLost: boolean = true): void {
    if (attempt !== this.attempt || this.hasClosed)
      return;
    this.buffered = null;
    this.addedCommands = null;
    if (isLost)
      this.sink.showLost();
  }

  private reattach(): void {
    this.isAttached = false;
    if (this.isVisible)
      void this.attachAsync();
  }

  private accept(output: TerminalOutput): void {
    if (output.sessionId !== this.sessionId)
      return;
    if (this.buffered !== null) {
      this.buffered.push(output);
      return;
    }
    const end: number = output.endOffset;
    if (!this.isAttached || end <= this.expected)
      return;
    if (output.offset > this.expected) {
      void this.attachAsync();
      return;
    }
    const previous: number = this.expected;
    const data: string = output.data.slice(previous - output.offset);
    this.expected = end;
    this.sink.follow(output.stored);
    let from: number = 0;
    for (const input of output.inputs) {
      if (input.offset <= previous)
        continue;
      const index: number = input.offset - previous;
      this.sink.write(data.slice(from, index), () => this.sink.markInput(input.edge));
      from = index;
    }
    this.sink.write(data.slice(from), () => this.acknowledge(end));
  }

  private addCommand(added: TerminalCommandAdded): void {
    if (added.sessionId !== this.sessionId)
      return;
    if (this.addedCommands === null)
      this.sink.addCommand(added.command);
    else
      this.addedCommands.push(added.command);
  }

  private showExit(exited: TerminalExited): void {
    if (exited.sessionId !== this.sessionId)
      return;
    if (this.buffered === null)
      this.sink.showExit(exited.exit);
    else {
      this.heldExit = exited.exit;
      this.isRunningHeld = false;
    }
  }

  private showRunning(reference: TerminalReference): void {
    if (reference.sessionId !== this.sessionId)
      return;
    if (this.buffered !== null) {
      this.heldExit = null;
      this.isRunningHeld = true;
    }
    else if (this.isAttached)
      this.sink.showRunning();
  }

  private showTitle(title: TerminalTitle): void {
    if (title.sessionId === this.sessionId)
      this.sink.showTitle(title.title);
  }

  private showCwd(cwd: TerminalCwd): void {
    if (cwd.sessionId === this.sessionId)
      this.sink.showCwd(cwd.cwd);
  }

  private detach(pane: TerminalPaneReference): void {
    if (pane.sessionId !== this.sessionId || pane.paneId !== this.paneId || !this.isAttached)
      return;
    this.isAttached = false;
    if (this.isVisible)
      void this.attachAsync();
  }

  private detachClosed(attempt: number): void {
    if (attempt === this.attempt && !this.isDetachSent)
      this.sendDetach();
  }

  private sendDetach(): void {
    this.isDetachSent = true;
    this.send(TerminalNames.detachMethod, new TerminalPaneReference(this.sessionId, this.paneId).toJson());
  }

  private isSending(): boolean {
    return !this.isGone() && (this.isAttached || this.refreshing === this.attempt);
  }

  private acknowledge(offset: number): void {
    if (this.isAttached && !this.isGone())
      this.send(TerminalNames.ackMethod, new TerminalAckParams(this.sessionId, this.paneId, offset).toJson());
  }

  private listen(event: string, listener: (payload: JsonValue) => void): void {
    this.unsubscribes.push(this.context.onEvent(event, t => {
      try {
        listener(t);
      }
      catch (error) {
        this.context.log(Resources.formatRequestFailed(event, error));
      }
    }));
  }

  private isGone(): boolean {
    return this.goneAttempt === this.attempt;
  }

  private send(method: string, parameters: JsonValue): void {
    const attempt: number = this.attempt;
    this.context.requestAsync(method, parameters).then(undefined, (error: unknown) => {
      if (!TerminalRuntimeClient.isNotFound(error))
        this.context.log(Resources.formatRequestFailed(method, error));
      else if (attempt === this.attempt)
        this.goneAttempt = attempt;
    });
  }
}
