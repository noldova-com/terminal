/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CommandTokenKind } from "../enums/command-token-kind.ts";

export class CommandToken {
  public readonly start: number;
  public readonly end: number;
  public readonly kind: CommandTokenKind;

  public constructor(start: number, end: number, kind: CommandTokenKind) {
    this.start = start;
    this.end = end;
    this.kind = kind;
  }
}
