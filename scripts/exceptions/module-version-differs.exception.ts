/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class ModuleVersionDiffersException extends PackageException {
  public readonly file: string;
  public readonly found: string;
  public readonly version: string;

  public constructor(file: string, found: string, version: string) {
    super(Resources.formatModuleVersionDiffers(file, found, version));

    this.file = file;
    this.found = found;
    this.version = version;
  }
}
