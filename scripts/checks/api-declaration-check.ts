/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ts from "typescript";

import { ApiCatalog } from "../api/api-catalog.ts";
import { ApiDeclarationSession } from "../api/api-declaration-session.ts";
import type { ApiPackage } from "../api/api-package.ts";
import { ApiProgram } from "../api/api-program.ts";
import { ApiSurfaceReader } from "../api/api-surface.reader.ts";
import { ApiException } from "../api/api.exception.ts";
import { ApiResources } from "../api/api.resources.ts";

export class ApiDeclarationCheck {
  private readonly catalog: ApiCatalog;
  private readonly session: ApiDeclarationSession;

  public constructor(root: string) {
    this.catalog = new ApiCatalog(root);
    this.session = new ApiDeclarationSession(root);
  }

  public async runAsync(): Promise<readonly string[]> {
    return await this.catalog.inspectEachAsync(ApiResources.declarationVerdict, t => this.inspectAsync(t));
  }

  private static readErrors(api: ApiProgram, file: string): readonly string[] {
    const [source] = api.readModule(file);
    const diagnostics = [...api.program.getSyntacticDiagnostics(source), ...api.program.getSemanticDiagnostics(source)];
    return diagnostics.filter(t => t.category === ts.DiagnosticCategory.Error).map(t => ApiProgram.describe(t));
  }

  private async inspectAsync(apiPackage: ApiPackage): Promise<readonly string[]> {
    try {
      return await this.session.useAsync(apiPackage, ApiResources.declarationPurpose, [apiPackage.implementation, apiPackage.declarations], t => {
        const errors = ApiDeclarationCheck.readErrors(t, apiPackage.declarations);
        if (errors.length > 0)
          return errors;
        const reader = new ApiSurfaceReader(t, apiPackage.visibility);
        return reader.read(apiPackage.implementation).compare(reader.read(apiPackage.declarations));
      });
    }
    catch (error) {
      return [ApiException.describe(error)];
    }
  }
}

const problems: readonly string[] = await new ApiDeclarationCheck(process.cwd()).runAsync();
for (const problem of problems)
  console.error(problem);
process.exitCode = problems.length > 0 ? 1 : 0;
