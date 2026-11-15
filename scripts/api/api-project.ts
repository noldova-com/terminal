/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Resources } from "../resources.ts";
import { ApiResources } from "./api.resources.ts";

export class ApiProject {
  public readonly folder: string;
  public readonly file: string;

  public constructor(root: string, purpose: string, id: string) {
    this.folder = path.join(root, ApiResources.buildFolder, purpose, id);
    this.file = path.join(this.folder, Resources.projectFile);
  }

  public async writeAsync(base: string, root: string, files: readonly string[]): Promise<void> {
    await mkdir(this.folder, { recursive: true });
    const project = { extends: base, compilerOptions: { noEmit: true, rootDir: root }, files };
    await writeFile(this.file, ApiResources.formatProjectJson(project));
  }
}
