/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalShellKind } from "@noldova/terminal.protocol";

export class ShellCandidate {
  public readonly id: string;
  public readonly name: string;
  public readonly kind: TerminalShellKind;
  public readonly files: readonly string[];
  public readonly args: readonly string[];

  public constructor(id: string, name: string, kind: TerminalShellKind, files: readonly string[], args: readonly string[]) {
    this.id = id;
    this.name = name;
    this.kind = kind;
    this.files = files;
    this.args = args;
  }
}
