/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { TerminalProtocolException } from "./terminal-protocol.exception.ts";

export class PackageCopiesException extends TerminalProtocolException {
  public override readonly name: string = "PackageCopiesException";

  public constructor() {
    super(Resources.runtimeOwnersCopies);
  }
}
