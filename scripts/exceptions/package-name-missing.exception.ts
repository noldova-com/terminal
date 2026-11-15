/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class PackageNameMissingException extends PackageException {
  public readonly file: string;

  public constructor(file: string) {
    super(Resources.formatPackageNameMissing(file));

    this.file = file;
  }
}
