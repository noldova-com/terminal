/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalInputMark } from "@noldova/terminal.protocol";

export interface IOutputBatcherListener {
  onBatch(offset: number, data: string, inputs: readonly TerminalInputMark[]): void;
}
