/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";

export class SignalRace {
  public static async raceAsync<TResult>(task: Promise<TResult>, signal: AbortSignal, createError: () => Error): Promise<TResult> {
    const { promise: ended, reject } = Promise.withResolvers<never>();
    const onAbort = (): void => reject(createError());
    if (signal.aborted)
      onAbort();
    else
      signal.addEventListener(Resources.abortEvent, onAbort, { once: true });
    try {
      return await Promise.race([ended, task]);
    }
    finally {
      signal.removeEventListener(Resources.abortEvent, onAbort);
    }
  }
}
