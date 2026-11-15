/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TrackedCommand {
  public readonly outputStart: number;
  public readonly hasOutputStart: boolean;
  public outputEnd: number | null = null;
  public exitCode: number | null = null;
  public cwd: string | null = null;

  public constructor(outputStart: number, hasOutputStart: boolean) {
    this.outputStart = outputStart;
    this.hasOutputStart = hasOutputStart;
  }

  public get hasEnded(): boolean {
    return this.outputEnd !== null;
  }

  public end(outputEnd: number, exitCode: number | null, cwd: string | null): void {
    this.outputEnd = outputEnd;
    this.exitCode = exitCode;
    this.cwd = cwd;
  }
}
