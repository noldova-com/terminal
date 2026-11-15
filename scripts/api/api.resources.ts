/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";

export class ApiResources {
  public static readonly buildFolder: string = "_build";
  public static readonly declarationPurpose: string = "api-declarations";
  public static readonly declarationVerdict: string = "matches its declarations";
  public static readonly exampleVerdict: string = "its examples compile";
  public static readonly listSeparator: string = ", ";
  public static readonly space: string = " ";
  public static readonly mainEntrySubpath: string = ".";
  public static readonly mainEntryName: string = "index";
  public static readonly entrySourcePattern: RegExp = /^\.\/src\/api\/([a-z][a-z0-9-]*)\.ts$/;
  public static readonly entryProjects: ReadonlyMap<string, string> = new Map([[`${Resources.moduleFolder}/window`, Resources.windowFolder]]);
  public static readonly generatedPrefix: string = "ɵ";
  public static readonly prototypeMember: string = "prototype";
  public static readonly constructorMember: string = "__constructor";
  public static readonly exampleTag: string = "example";
  public static readonly exampleTypes: string = "node";
  public static readonly exampleFenceStart: RegExp = /^```(?:ts|typescript)\s*$/;
  public static readonly exampleFenceEnd: RegExp = /^```\s*$/;
  public static readonly exampleUnfenced: string = "This @example has no ```ts code fence, so the example check can't compile it.";
  public static readonly docLinePrefix: RegExp = /^\s*\*(?: |$)/;
  public static readonly lineBreakPattern: RegExp = /\r?\n/;

  public static formatCatalogVerdict(title: string, verdict: string): string {
    return `${title}: ${verdict}`;
  }

  public static formatCatalogProblem(title: string, problem: string): string {
    return `${title}: ${problem}`;
  }

  public static formatDiagnostic(code: number, message: string): string {
    return `TS${code}: ${message}`;
  }

  public static formatEntryId(id: string, entryName: string): string {
    return `${id}-${entryName}`;
  }

  public static formatEntryNoExports(file: string): string {
    return `${file} exports no entries, so its API cannot be checked.`;
  }

  public static formatEntryNotDeclarations(file: string, subpath: string, target: string): string {
    return `${file} exports ${subpath} as ${target}, which is not a src/api/<entry>.ts file beside its src/api/<entry>.d.ts, so it cannot be checked.`;
  }

  public static formatEntryProject(directory: string, entryName: string): string {
    return `${directory}/${entryName}`;
  }

  public static formatEntryTitle(directory: string, subpath: string): string {
    return `${directory} (${subpath})`;
  }

  public static formatEntryUnreadable(file: string): string {
    return `${file} could not be read as JSON, so the entries whose declarations are checked are unknown.`;
  }

  public static formatExampleFile(declarations: string, line: number): string {
    return `${declarations.slice(0, -Resources.declarationExtension.length)}.example-${line}${Resources.sourceExtension}`;
  }

  public static formatExampleProblem(file: string, line: number, message: string): string {
    return `${file}:${line}: ${message}`;
  }

  public static formatExportPath(path: string, name: string): string {
    return `${path}.${name}`;
  }

  public static formatMemberPath(path: string, name: string): string {
    return `${path}#${name}`;
  }

  public static formatNoDeclarations(declarations: string): string {
    return `no declarations at ${declarations}`;
  }

  public static formatNotModule(file: string): string {
    return `${file} is not an ES module of the project.`;
  }

  public static formatProgramUnreadable(projectFile: string, problems: readonly string[]): string {
    return `TypeScript could not read ${projectFile}:${Resources.lineEnd}${problems.join(Resources.lineEnd)}`;
  }

  public static formatProjectJson(project: unknown): string {
    return `${JSON.stringify(project, null, Resources.jsonIndent)}${Resources.lineEnd}`;
  }

  public static formatSurfaceDiffers(path: string, implemented: string, declared: string): string {
    return `${path}: the implementation has ${implemented}; the declarations have ${declared}`;
  }

  public static formatSurfaceMissing(path: string, implemented: string): string {
    return `${path}: missing from the declarations; the implementation has ${implemented}`;
  }

  public static formatSurfaceUnimplemented(path: string, declared: string): string {
    return `${path}: declared but not implemented; the declarations have ${declared}`;
  }
}
