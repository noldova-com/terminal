/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalShellKind } from "@noldova/terminal.protocol";

import { Resources } from "../resources.ts";
import { TerminalException } from "./terminal.exception.ts";

export class ShellKindNotFoundException extends TerminalException {
  public readonly shellKinds: readonly TerminalShellKind[];

  public constructor(shellKinds: readonly TerminalShellKind[]) {
    super(Resources.formatShellKindNotFound(shellKinds));

    this.shellKinds = [...shellKinds];
  }
}
