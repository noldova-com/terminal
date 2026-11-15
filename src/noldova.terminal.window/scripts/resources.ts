/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly lineFeed: string = "\n";
  public static readonly textEncoding: BufferEncoding = "utf8";
  public static readonly jsonIndent: number = 2;
  public static readonly apiFolder: string = "api";
  public static readonly projectFile: string = "tsconfig.json";
  public static readonly sourceExtension: string = ".ts";
  public static readonly declarationExtension: string = ".d.ts";
  public static readonly compilerManifest: readonly string[] = ["node_modules", "@angular", "compiler-cli", "package.json"];
  public static readonly compilerCommand: string = "ngc";
  public static readonly compilerProjectOption: string = "-p";
  public static readonly workSegments: readonly string[] = ["..", "..", "_build", "window", "angular-package"];
  public static readonly angularWorkPrefix: string = "noldova-angular-package-";
  public static readonly angularCompileTimeout: number = 300_000;

  public static formatAngularCompileFailed(sources: string, exitCode: number | null, output: string): string {
    return `Compiling ${sources} with the Angular compiler failed with exit code ${exitCode}:
${output}`;
  }

  public static formatAngularCompileTimedOut(sources: string, timeout: number): string {
    return `Compiling ${sources} with the Angular compiler did not finish within ${timeout} ms.`;
  }

  public static formatAngularCompilerCommandMissing(manifest: string, command: string): string {
    return `${manifest} names no ${command} command.`;
  }

  public static formatAngularCompilerMissing(project: string): string {
    return `The Angular project in ${project} has no Angular compiler to run; npm ci installs one.`;
  }

  public static formatAngularEntriesMissing(entries: string): string {
    return `${entries} has no entry files to compile.`;
  }
}
