/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class WaitingRun {
  public readonly runId: string;
  public readonly connection: number;
  public readonly window: number | null;
  public remainingEnds: number;
  public exitCode: number | null = null;
  public offset: number;
  public paste: string;
  public isAfterEndMark: boolean = false;

  public constructor(runId: string, connection: number, window: number | null, remainingEnds: number, offset: number, paste: string) {
    this.runId = runId;
    this.connection = connection;
    this.window = window;
    this.remainingEnds = remainingEnds;
    this.offset = offset;
    this.paste = paste;
  }
}
