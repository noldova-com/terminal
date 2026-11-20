/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ReadDroppedException } from "../exceptions/read-dropped.exception.ts";
import type { IQueuedRead } from "../interfaces/i-queued-read.ts";
import { Resources } from "../resources.ts";

export class SharedRead<T> implements IQueuedRead {
  public readonly promise: Promise<T>;
  private readonly answer: PromiseWithResolvers<T> = Promise.withResolvers<T>();
  private readonly read: () => Promise<T>;
  private interest: number = 0;
  private hasStarted: boolean = false;

  public constructor(read: () => Promise<T>) {
    this.read = read;
    this.promise = this.answer.promise;
  }

  public watch(signal: AbortSignal, onDropped: () => void): void {
    this.interest++;
    signal.addEventListener(Resources.abortEvent, () => {
      if (this.hasStarted || --this.interest > 0)
        return;
      this.answer.reject(new ReadDroppedException());
      onDropped();
    }, { once: true });
  }

  public startAsync(): Promise<void> {
    this.hasStarted = true;
    return this.read().then(this.answer.resolve, this.answer.reject);
  }
}
