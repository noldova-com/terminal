/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { TerminalException } from "./terminal.exception.ts";

export class FolderNotFoundException extends TerminalException {
  public readonly folder: string;

  public constructor(folder: string) {
    super(Resources.formatFolderNotFound(folder));

    this.folder = folder;
  }
}
