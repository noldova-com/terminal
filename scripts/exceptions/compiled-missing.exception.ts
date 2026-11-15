/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class CompiledMissingException extends PackageException {
  public readonly folder: string;

  public constructor(folder: string) {
    super(Resources.formatCompiledMissing(folder));

    this.folder = folder;
  }
}
