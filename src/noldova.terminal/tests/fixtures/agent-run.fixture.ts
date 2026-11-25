/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class AgentRun {
  public readonly command: string;
  public readonly timeoutMilliseconds: number;

  public constructor(command: string, timeoutMilliseconds: number) {
    this.command = command;
    this.timeoutMilliseconds = timeoutMilliseconds;
  }
}
