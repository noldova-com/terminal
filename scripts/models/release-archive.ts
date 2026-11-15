/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModulePackage } from "../interfaces/i-module-package.ts";

export class ReleaseArchive {
  public readonly part: IModulePackage;
  public readonly filePath: string;

  public constructor(part: IModulePackage, filePath: string) {
    this.part = part;
    this.filePath = filePath;
  }
}
