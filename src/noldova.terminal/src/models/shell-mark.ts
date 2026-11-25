/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { MarkKind } from "../enums/mark-kind.ts";

export class ShellMark {
  public readonly kind: MarkKind;
  public readonly value: string | null;
  public readonly offset: number;
  public readonly values: readonly string[];

  public constructor(kind: MarkKind, value: string | null, offset: number, values: readonly string[] = Object.isNull(value) ? [] : [value]) {
    this.kind = kind;
    this.value = value;
    this.offset = offset;
    this.values = values;
  }
}
