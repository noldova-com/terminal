/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class ExportSourceInvalidException extends PackageException {
  public readonly file: string;
  public readonly subpath: string;

  public constructor(file: string, subpath: string) {
    super(Resources.formatExportSourceInvalid(file, subpath));

    this.file = file;
    this.subpath = subpath;
  }
}
