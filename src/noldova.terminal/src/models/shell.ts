/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalShell, type TerminalShellKind } from "@noldova/terminal.protocol";

export class Shell {
  public readonly id: string;
  public readonly name: string;
  public readonly kind: TerminalShellKind;
  public readonly file: string;
  public readonly args: readonly string[];
  public readonly isDefault: boolean;
  public readonly startCommand: string | null;

  public constructor(id: string, name: string, kind: TerminalShellKind, file: string, args: readonly string[], isDefault: boolean,
    startCommand: string | null = null) {
    this.id = id;
    this.name = name;
    this.kind = kind;
    this.file = file;
    this.args = args;
    this.isDefault = isDefault;
    this.startCommand = startCommand;
  }

  public toTerminalShell(): TerminalShell {
    return new TerminalShell(this.id, this.name, this.kind, this.isDefault);
  }
}
