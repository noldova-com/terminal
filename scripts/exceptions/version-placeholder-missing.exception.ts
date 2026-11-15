/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class VersionPlaceholderMissingException extends PackageException {
  public readonly file: string;
  public readonly found: string;

  public constructor(file: string, found: string) {
    super(Resources.formatVersionPlaceholderMissing(file, found));

    this.file = file;
    this.found = found;
  }
}
