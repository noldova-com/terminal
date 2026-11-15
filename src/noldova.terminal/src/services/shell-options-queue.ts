/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWaitingOptionsRequest } from "../interfaces/i-waiting-options-request.ts";
import { ShellOptionsReply } from "../models/shell-options-reply.ts";

export class ShellOptionsQueue {
  private readonly waiting: IWaitingOptionsRequest[] = [];

  public askAsync(milliseconds: number): Promise<ShellOptionsReply> {
    return new Promise<ShellOptionsReply>(resolve => {
      const request: IWaitingOptionsRequest = { settle: null };
      const timer: ReturnType<typeof setTimeout> = setTimeout(() => request.settle?.(ShellOptionsReply.timedOut), milliseconds);
      request.settle = t => {
        clearTimeout(timer);
        request.settle = null;
        resolve(t);
      };
      this.waiting.push(request);
    });
  }

  public answer(options: readonly string[]): void {
    this.waiting.shift()?.settle?.(new ShellOptionsReply(options, false));
  }

  public cancel(): void {
    for (const request of this.waiting)
      request.settle?.(ShellOptionsReply.none);
  }

  public reset(): void {
    this.cancel();
    this.waiting.length = 0;
  }
}
