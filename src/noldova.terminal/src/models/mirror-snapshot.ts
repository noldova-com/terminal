/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalInputStart } from "@noldova/terminal.protocol";

export class MirrorSnapshot {
  public readonly snapshot: string;
  public readonly pending: string;
  public readonly offset: number;
  public readonly input: TerminalInputStart | null;

  public constructor(snapshot: string, pending: string, offset: number, input: TerminalInputStart | null = null) {
    this.snapshot = snapshot;
    this.pending = pending;
    this.offset = offset;
    this.input = input;
  }
}
