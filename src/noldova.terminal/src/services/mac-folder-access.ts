/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ICommandRunner } from "../interfaces/i-command-runner.ts";
import type { IFolderAccess } from "../interfaces/i-folder-access.ts";
import { Resources } from "../resources.ts";

export class MacFolderAccess implements IFolderAccess {
  private readonly runner: ICommandRunner;

  public constructor(runner: ICommandRunner) {
    this.runner = runner;
  }

  public async restrictAsync(folder: string): Promise<void> {
    await this.runner.runAsync(Resources.chmodPath, [...Resources.aclRemovalArguments, folder], Resources.folderAccessMilliseconds);
  }
}
