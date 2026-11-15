/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalShellKind } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";
import { TerminalRunRefusedException } from "./terminal-run-refused.exception.ts";

export class RunShellKindsMissingException extends TerminalRunRefusedException {
  public override readonly name: string = "RunShellKindsMissingException";
  public override readonly parameter: string = Resources.shellKindsArgument;
  public readonly shellKinds: readonly TerminalShellKind[];

  public constructor(shellKinds: readonly TerminalShellKind[]) {
    super(Resources.formatRunRefused(Resources.formatNoShellOfKinds(shellKinds)));

    this.shellKinds = shellKinds;
  }
}
