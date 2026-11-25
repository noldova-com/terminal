/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalHistorySegment } from "../services/terminal-history-segment.ts";

export class TakenSegment {
  public readonly segment: TerminalHistorySegment;
  public readonly buffer: Buffer;

  public constructor(segment: TerminalHistorySegment, buffer: Buffer) {
    this.segment = segment;
    this.buffer = buffer;
  }
}
