/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Failure, FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";

export class ShellNotFoundException extends MethodFailureException {
  public override readonly name: string = "ShellNotFoundException";
  public readonly shellId: string;

  public constructor(shellId: string) {
    super(new Failure(FailureCode.NotFound, Resources.formatShellNotFound(shellId)));

    this.shellId = shellId;
  }
}
