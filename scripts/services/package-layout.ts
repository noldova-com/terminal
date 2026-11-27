/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { PackageNameMissingException } from "../exceptions/package-name-missing.exception.ts";
import type { IModulePackage } from "../interfaces/i-module-package.ts";
import { ModulePackage } from "../models/module-package.ts";
import { Resources } from "../resources.ts";

export class PackageLayout {
  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public async readPackagesAsync(): Promise<readonly IModulePackage[]> {
    const packages: IModulePackage[] = [];
    for (const folder of Resources.packageFolders) {
      const file = path.posix.join(folder, Resources.manifestFile);
      const manifest: unknown = JSON.parse(await readFile(path.join(this.root, file), Resources.textEncoding));
      const name: unknown = typeof manifest === "object" && manifest !== null && "name" in manifest ? manifest.name : undefined;
      if (typeof name !== "string")
        throw new PackageNameMissingException(file);
      packages.push(new ModulePackage(folder, name));
    }
    return packages;
  }
}
