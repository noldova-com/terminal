/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModulePackage } from "../interfaces/i-module-package.ts";

export class ModulePackage implements IModulePackage {
  public readonly folder: string;
  public readonly name: string;

  public constructor(folder: string, name: string) {
    this.folder = folder;
    this.name = name;
  }
}
