/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import path from "node:path";

import { CommandVariableNotSetException } from "../exceptions/command-variable-not-set.exception.ts";
import type { ICommandRunner } from "../interfaces/i-command-runner.ts";
import type { IFolderAccess } from "../interfaces/i-folder-access.ts";
import { Resources } from "../resources.ts";

export class WindowsFolderAccess implements IFolderAccess {
  private readonly runner: ICommandRunner;
  private readonly systemRoot: string | undefined;

  public constructor(runner: ICommandRunner, systemRoot: string | undefined) {
    this.runner = runner;
    this.systemRoot = systemRoot;
  }

  public async restrictAsync(folder: string): Promise<void> {
    if (Object.isUndefined(this.systemRoot) || this.systemRoot.length === 0)
      throw new CommandVariableNotSetException(Resources.icaclsFile, Resources.systemRootVariable);
    await this.runner.runAsync(path.win32.join(this.systemRoot, ...Resources.icaclsPath), [folder, ...Resources.privateFolderGrants],
      Resources.folderAccessMilliseconds);
  }
}
