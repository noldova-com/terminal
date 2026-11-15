/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPtyProcess } from "./i-pty-process.ts";

export interface IPtySpawner {
  spawnAsync(file: string, args: readonly string[] | string, folder: string, columns: number, rows: number, environment: Readonly<Record<string, string>>,
    inheritCursor: boolean): Promise<IPtyProcess>;
}
