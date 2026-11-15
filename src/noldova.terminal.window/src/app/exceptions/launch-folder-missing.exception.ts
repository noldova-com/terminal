/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";
import { TerminalLaunchRefusedException } from "./terminal-launch-refused.exception.ts";

export class LaunchFolderMissingException extends TerminalLaunchRefusedException {
  public override readonly name: string = "LaunchFolderMissingException";
  public override readonly parameter: string = Resources.folderArgument;
  public readonly folder: string;

  public constructor(folder: string) {
    super(Resources.formatLaunchRefused(Resources.formatLaunchFolderMissing(folder)));

    this.folder = folder;
  }
}
