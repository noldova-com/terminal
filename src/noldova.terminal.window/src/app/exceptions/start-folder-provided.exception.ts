/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";
import { TerminalWindowException } from "./terminal-window.exception.ts";

export class StartFolderProvidedException extends TerminalWindowException {
  public override readonly name: string = "StartFolderProvidedException";

  public constructor() {
    super(Resources.startFolderProvided);
  }
}
