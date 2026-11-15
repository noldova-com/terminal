/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalShellKind } from "@noldova/terminal.protocol";

export class TerminalTabLabel {
  public readonly name: string | null;
  public readonly shellName: string | null;
  public readonly shellKind: TerminalShellKind;

  public constructor(name: string | null, shellName: string | null, shellKind: TerminalShellKind) {
    this.name = name;
    this.shellName = shellName;
    this.shellKind = shellKind;
  }
}
