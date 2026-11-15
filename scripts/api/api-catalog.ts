/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ScriptException } from "../exceptions/script.exception.ts";
import { PackageLayout } from "../services/package-layout.ts";
import { ApiEntry } from "./api-entry.ts";
import { ApiPackage } from "./api-package.ts";
import { ApiResources } from "./api.resources.ts";

export class ApiCatalog {
  private readonly root: string;
  private readonly layout: PackageLayout;

  public constructor(root: string) {
    this.root = root;
    this.layout = new PackageLayout(root);
  }

  public async listAsync(): Promise<readonly ApiPackage[]> {
    const packages: ApiPackage[] = [];
    for (const modulePackage of await this.layout.readPackagesAsync())
      packages.push(...(await ApiEntry.readAsync(this.root, modulePackage.folder)).map(t => ApiPackage.forPackage(this.root, modulePackage, t)));
    return packages;
  }

  public async inspectEachAsync(verdict: string, inspectAsync: (apiPackage: ApiPackage, apiPackages: readonly ApiPackage[]) => Promise<readonly string[]>): Promise<readonly string[]> {
    const apiPackages = await this.listOrReportAsync();
    if (typeof apiPackages === "string")
      return [apiPackages];
    const found: string[] = [];
    for (const apiPackage of apiPackages) {
      const problems = await inspectAsync(apiPackage, apiPackages);
      if (problems.length === 0)
        console.log(ApiResources.formatCatalogVerdict(apiPackage.title, verdict));
      found.push(...problems.map(t => ApiResources.formatCatalogProblem(apiPackage.title, t)));
    }
    return found;
  }

  private async listOrReportAsync(): Promise<readonly ApiPackage[] | string> {
    try {
      return await this.listAsync();
    }
    catch (error) {
      if (!(error instanceof ScriptException))
        throw error;
      return error.message;
    }
  }
}
