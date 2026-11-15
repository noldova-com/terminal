/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EventChannel } from "@noldova/desktop.runtime";

export class TerminalEvents {
  public readonly output: EventChannel;
  public readonly exited: EventChannel;
  public readonly restarted: EventChannel;
  public readonly titleChanged: EventChannel;
  public readonly cwdChanged: EventChannel;
  public readonly detached: EventChannel;
  public readonly closed: EventChannel;
  public readonly opened: EventChannel;
  public readonly launchCommandEnded: EventChannel;
  public readonly runOpened: EventChannel;
  public readonly runEnded: EventChannel;
  public readonly renamed: EventChannel;
  public readonly commandAdded: EventChannel;

  public constructor(output: EventChannel, exited: EventChannel, restarted: EventChannel, titleChanged: EventChannel, cwdChanged: EventChannel,
    detached: EventChannel, closed: EventChannel, opened: EventChannel, launchCommandEnded: EventChannel, runOpened: EventChannel,
    runEnded: EventChannel, renamed: EventChannel, commandAdded: EventChannel) {
    this.output = output;
    this.exited = exited;
    this.restarted = restarted;
    this.titleChanged = titleChanged;
    this.cwdChanged = cwdChanged;
    this.detached = detached;
    this.closed = closed;
    this.opened = opened;
    this.launchCommandEnded = launchCommandEnded;
    this.runOpened = runOpened;
    this.runEnded = runEnded;
    this.renamed = renamed;
    this.commandAdded = commandAdded;
  }
}
