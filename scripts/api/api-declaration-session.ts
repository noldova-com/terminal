/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";

import { ApiDeclarationsMissingException } from "./api-declarations-missing.exception.ts";
import type { ApiPackage } from "./api-package.ts";
import { ApiProgram } from "./api-program.ts";
import { ApiProject } from "./api-project.ts";

export class ApiDeclarationSession {
  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public async useAsync<T>(apiPackage: ApiPackage, purpose: string, files: readonly string[], read: (api: ApiProgram) => T): Promise<T> {
    if (!existsSync(apiPackage.declarations))
      throw new ApiDeclarationsMissingException(apiPackage.declarations);
    const project = new ApiProject(this.root, purpose, apiPackage.id);
    await project.writeAsync(apiPackage.project, this.root, files);
    return read(ApiProgram.open(project.file));
  }
}
