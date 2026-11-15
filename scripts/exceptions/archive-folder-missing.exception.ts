/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class ArchiveFolderMissingException extends PackageException {
  public readonly folder: string;

  public constructor(folder: string) {
    super(Resources.formatArchiveFolderMissing(folder));

    this.folder = folder;
  }
}
