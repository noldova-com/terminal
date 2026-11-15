/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IDisposable } from "./i-disposable.ts";
import type { IPtyExitEvent } from "./i-pty-exit-event.ts";

export interface IPtyProcess {
  readonly pid: number | null;

  onData(listener: (data: string) => void): IDisposable;

  onExit(listener: (event: IPtyExitEvent) => void): IDisposable;

  write(data: string): void;

  resize(columns: number, rows: number): void;

  pause(): void;

  resume(): void;

  endAsync(): Promise<boolean>;

  readForegroundProcessGroupAsync(): Promise<number | null>;
}
