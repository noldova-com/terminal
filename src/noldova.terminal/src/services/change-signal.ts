/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";

export class ChangeSignal {
  private waiters: (() => void)[] = [];

  public notify(): void {
    for (const waiter of this.waiters.splice(0))
      waiter();
  }

  public async waitUntilAsync(condition: () => boolean, timeoutMilliseconds: number | null, signal: AbortSignal): Promise<void> {
    const deadline: number | null = timeoutMilliseconds === null ? null : Date.now() + timeoutMilliseconds;
    while (!condition() && !signal.aborted && (deadline === null || Date.now() < deadline))
      await this.waitAsync(deadline === null ? null : deadline - Date.now(), signal);
  }

  private waitAsync(timeoutMilliseconds: number | null, signal: AbortSignal): Promise<void> {
    return new Promise<void>(resolve => {
      const done = (): void => {
        clearTimeout(timer);
        signal.removeEventListener(Resources.abortEvent, done);
        this.waiters = this.waiters.filter(t => t !== done);
        resolve();
      };
      const timer: NodeJS.Timeout | undefined = timeoutMilliseconds === null ? undefined : setTimeout(done, timeoutMilliseconds);
      signal.addEventListener(Resources.abortEvent, done);
      this.waiters.push(done);
    });
  }
}
