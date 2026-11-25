/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.ts";

export class ChangeSignal {
  private waiters: (() => void)[] = [];

  public notify(): void {
    for (const waiter of this.waiters.splice(0))
      waiter();
  }

  public async waitUntilAsync(condition: () => boolean, timeoutMilliseconds: number | null, signal: AbortSignal): Promise<void> {
    const deadline: number | null = Object.isNull(timeoutMilliseconds) ? null : Date.now() + timeoutMilliseconds;
    while (!condition() && !signal.aborted && (Object.isNull(deadline) || Date.now() < deadline))
      await this.waitAsync(Object.isNull(deadline) ? null : deadline - Date.now(), signal);
  }

  private waitAsync(timeoutMilliseconds: number | null, signal: AbortSignal): Promise<void> {
    return new Promise<void>(resolve => {
      const done = (): void => {
        clearTimeout(timer);
        signal.removeEventListener(Resources.abortEvent, done);
        this.waiters = this.waiters.filter(t => t !== done);
        resolve();
      };
      const timer: NodeJS.Timeout | undefined = Object.isNull(timeoutMilliseconds) ? undefined : setTimeout(done, timeoutMilliseconds);
      signal.addEventListener(Resources.abortEvent, done);
      this.waiters.push(done);
    });
  }
}
