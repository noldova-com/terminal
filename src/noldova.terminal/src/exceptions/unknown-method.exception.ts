/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { TerminalException } from "./terminal.exception.ts";

export class UnknownMethodException extends TerminalException {
  public readonly method: string;

  public constructor(method: string) {
    super(Resources.formatUnknownMethod(method));

    this.method = method;
  }
}
