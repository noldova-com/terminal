/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { TerminalException } from "./terminal.exception.ts";

export class ReadDroppedException extends TerminalException {
  public constructor() {
    super(Resources.readDropped);
  }
}
