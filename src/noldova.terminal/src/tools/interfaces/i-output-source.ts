/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { OutputChunk } from "../models/output-chunk.ts";

export interface IOutputSource {
  readSince(offset: number): OutputChunk;
  waitForOutputAsync(offset: number, timeoutMilliseconds: number, signal: AbortSignal): Promise<void>;
}
