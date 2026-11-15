/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import path from "node:path";

import { AngularPackageBuilder } from "../src/noldova.terminal.window/scripts/angular-package-builder.ts";
import { CdkCopyCheck } from "./checks/cdk-copy-check.ts";
import { PackageException } from "./exceptions/package.exception.ts";
import { ProcessException } from "./exceptions/process.exception.ts";
import { Resources } from "./resources.ts";
import { NpmCommand } from "./services/npm-command.ts";
import { PackagePacker } from "./services/package-packer.ts";
import { ProcessRunner } from "./services/process-runner.ts";

class Build {
  private static readonly root: string = path.dirname(import.meta.dirname);

  private readonly runner: ProcessRunner = new ProcessRunner();
  private readonly npm: NpmCommand = new NpmCommand(this.runner, process.env);
  private readonly packer: PackagePacker = new PackagePacker(Build.root, this.npm, this.runner, new AngularPackageBuilder(this.runner), t => Build.report(t));
  private readonly options: readonly string[];

  public constructor(options: readonly string[]) {
    this.options = options;
  }

  private static report(line: string): void {
    console.error(line);
  }

  public async runAsync(): Promise<number> {
    return this.options.includes(Resources.listCopiesOption) ? await this.listCopiesAsync() : await this.buildAsync();
  }

  private async hasOneCdkCopyAsync(): Promise<boolean> {
    try {
      return await new CdkCopyCheck(Build.root, Resources.windowFolder, this.npm).runAsync(process.stderr);
    }
    catch (error) {
      if (!(error instanceof ProcessException))
        throw error;
      Build.report(error.message);
      return false;
    }
  }

  private async listCopiesAsync(): Promise<number> {
    if (this.options.length !== 1) {
      Build.report(Resources.formatTakesNoOtherOption(Resources.listCopiesOption));
      return 1;
    }
    try {
      for (const copy of await this.packer.listCopiesAsync())
        process.stdout.write(Resources.formatListedCopy(copy.source, copy.packageName, copy.entry));
    }
    catch (error) {
      if (!(error instanceof PackageException))
        throw error;
      Build.report(error.message);
      return 1;
    }
    process.stdout.write(Resources.endOfCopies);
    return 0;
  }

  private async installAsync(): Promise<number> {
    if (existsSync(path.join(Build.root, Resources.modulesFolder)))
      return 0;
    const npmPath: string | undefined = process.env[Resources.npmPathVariable];
    if (npmPath === undefined || npmPath.length === 0) {
      Build.report(Resources.runThroughNpmRunBuild);
      return 1;
    }
    Build.report(Resources.installingPackages);
    return await this.runner.runAsync(process.execPath, [npmPath, ...Resources.cleanInstallArguments], Build.root);
  }

  private async buildAsync(): Promise<number> {
    const installed: number = await this.installAsync();
    if (installed !== 0)
      return installed;
    if (!await this.hasOneCdkCopyAsync())
      return 1;
    for (const project of Resources.compiledProjects) {
      const compiled: number = await this.runner.runAsync(process.execPath, [path.join(Build.root, ...Resources.typeScriptCompiler), Resources.projectOption, project], Build.root);
      if (compiled !== 0)
        return compiled;
    }
    return await this.packer.runAsync();
  }
}

process.exitCode = await new Build(process.argv.slice(2)).runAsync();
