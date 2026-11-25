/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.ts";

export class ResizeWakeup {
  private readonly write: (data: string) => void;
  private output: string | null = null;
  private isStalled: boolean = false;

  public constructor(write: (data: string) => void) {
    this.write = write;
  }

  public watch(): void {
    this.stop();
    this.output = "";
  }

  public receive(data: string): void {
    if (Object.isNull(this.output))
      return;
    this.output += data;
    if (Resources.escapesOnly.test(this.output))
      this.isStalled = Resources.resizeStall.test(this.output);
    else
      this.stop();
  }

  public beforeInput(): void {
    const isStalled: boolean = this.isStalled;
    this.stop();
    if (isStalled)
      this.write(Resources.abortKey);
  }

  public stop(): void {
    this.output = null;
    this.isStalled = false;
  }
}
