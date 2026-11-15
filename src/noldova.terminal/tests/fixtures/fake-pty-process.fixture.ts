/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPtyProcess } from "../../src/interfaces/i-pty-process.ts";
import { FakePtyHandle } from "./fake-pty-handle.fixture.ts";

export class FakePtyProcess extends FakePtyHandle implements IPtyProcess {
  private hasExited: boolean = false;
  public ends: number = 0;
  public isEndable: boolean = true;
  public foregroundProcessGroup: number | null = null;

  public override exit(exitCode: number | undefined, signal?: number): void {
    this.hasExited = true;
    super.exit(exitCode, signal);
  }

  public readForegroundProcessGroupAsync(): Promise<number | null> {
    return Promise.resolve(this.foregroundProcessGroup);
  }

  public endAsync(): Promise<boolean> {
    this.ends++;
    if (!this.hasExited && this.isEndable)
      this.exit(0, 1);
    return Promise.resolve(this.hasExited);
  }
}
