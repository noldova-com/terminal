/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CommandTokenKind } from "../enums/command-token-kind.ts";

export class CommandColors {
  private readonly colors: Readonly<Partial<Record<CommandTokenKind, string>>>;

  public constructor(colors: Readonly<Partial<Record<CommandTokenKind, string>>> = {}) {
    this.colors = { ...colors };
  }

  public colorOf(kind: CommandTokenKind): string | undefined {
    return this.colors[kind];
  }
}
