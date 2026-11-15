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
import { MacFolderAccess } from "./mac-folder-access.ts";
import { WindowsFolderAccess } from "./windows-folder-access.ts";

export class FolderAccess {
  public static create(platform: string, runner: ICommandRunner, environment: Readonly<Record<string, string | undefined>>): IFolderAccess | null {
    if (platform === Resources.windowsPlatform)
      return new WindowsFolderAccess(runner, environment[Resources.systemRootVariable]);
    if (platform === Resources.macPlatform)
      return new MacFolderAccess(runner);
    return null;
  }
}
