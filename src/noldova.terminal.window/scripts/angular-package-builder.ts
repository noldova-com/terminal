/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { ProcessTimeoutException } from "../../../scripts/exceptions/process-timeout.exception.ts";
import type { ProcessRunner } from "../../../scripts/services/process-runner.ts";
import { AngularCompileFailedException } from "./exceptions/angular-compile-failed.exception.ts";
import { AngularCompileTimedOutException } from "./exceptions/angular-compile-timed-out.exception.ts";
import { AngularCompilerCommandMissingException } from "./exceptions/angular-compiler-command-missing.exception.ts";
import { AngularCompilerMissingException } from "./exceptions/angular-compiler-missing.exception.ts";
import { AngularEntriesMissingException } from "./exceptions/angular-entries-missing.exception.ts";
import { Resources } from "./resources.ts";

export class AngularPackageBuilder {
  private readonly runner: ProcessRunner;

  public constructor(runner: ProcessRunner) {
    this.runner = runner;
  }

  public async compileAsync(project: string, sources: string, output: string, packages: ReadonlyMap<string, string>): Promise<void> {
    const entries = path.join(sources, Resources.apiFolder);
    const files = existsSync(entries)
      ? (await readdir(entries)).filter(t => t.endsWith(Resources.sourceExtension) && !t.endsWith(Resources.declarationExtension)).sort().map(t => path.join(entries, t))
      : [];
    if (files.length === 0)
      throw new AngularEntriesMissingException(entries);

    const workRoot = path.join(project, ...Resources.workSegments);
    await mkdir(workRoot, { recursive: true });
    const work = await mkdtemp(path.join(workRoot, Resources.angularWorkPrefix));
    try {
      const configuration = path.join(work, Resources.projectFile);
      await writeFile(configuration, `${JSON.stringify({
        extends: path.join(project, Resources.projectFile),
        compilerOptions: {
          rootDir: sources,
          outDir: output,
          declaration: false,
          sourceMap: true,
          types: [],
          paths: Object.fromEntries([...packages].map(([name, declarations]) => [name, [declarations]]))
        },
        angularCompilerOptions: { compilationMode: "partial" },
        files,
        include: []
      }, null, Resources.jsonIndent)}${Resources.lineFeed}`);
      const compiler = await AngularPackageBuilder.locateCompilerAsync(project);
      const result = await this.runner.captureAsync(process.execPath, [compiler, Resources.compilerProjectOption, configuration], project, Resources.angularCompileTimeout)
        .catch((error: unknown) => {
          if (error instanceof ProcessTimeoutException)
            throw new AngularCompileTimedOutException(sources, Resources.angularCompileTimeout, error);
          throw error;
        });
      if (!result.isSuccessful)
        throw new AngularCompileFailedException(sources, result.exitCode, result.text);
    }
    finally {
      await rm(work, { recursive: true, force: true });
    }
  }

  private static async locateCompilerAsync(project: string): Promise<string> {
    let folder = project;
    while (!existsSync(path.join(folder, ...Resources.compilerManifest)) && path.dirname(folder) !== folder)
      folder = path.dirname(folder);
    const manifest = path.join(folder, ...Resources.compilerManifest);
    if (!existsSync(manifest))
      throw new AngularCompilerMissingException(project);
    const parsed: unknown = JSON.parse(await readFile(manifest, Resources.textEncoding));
    const commands: unknown = typeof parsed === "object" && parsed !== null && "bin" in parsed ? parsed.bin : undefined;
    const command: unknown = typeof commands === "object" && commands !== null ? new Map<string, unknown>(Object.entries(commands)).get(Resources.compilerCommand) : undefined;
    if (typeof command !== "string")
      throw new AngularCompilerCommandMissingException(manifest, Resources.compilerCommand);
    return path.join(path.dirname(manifest), command);
  }
}
