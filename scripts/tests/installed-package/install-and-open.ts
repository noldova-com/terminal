/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProcessException } from "../../exceptions/process.exception.ts";
import { Resources } from "../../resources.ts";
import { NpmCommand } from "../../services/npm-command.ts";
import { ProcessRunner } from "../../services/process-runner.ts";

class InstalledPackage {
  private static readonly root: string = path.resolve(import.meta.dirname, "..", "..", "..");

  private readonly runner: ProcessRunner = new ProcessRunner();
  private readonly npm: NpmCommand = new NpmCommand(this.runner, process.env);

  private static async listAsync(folder: string, prefix: string): Promise<readonly string[]> {
    return (await readdir(folder)).filter(t => t.startsWith(prefix) && t.endsWith(Resources.archiveExtension)).sort().map(t => path.join(folder, t));
  }

  private static async emptyAsync(folder: string): Promise<string> {
    await rm(folder, { recursive: true, force: true });
    await mkdir(folder, { recursive: true });
    return folder;
  }

  private static async readTypesVersionAsync(): Promise<string | null> {
    const manifest: unknown = JSON.parse(await readFile(path.join(InstalledPackage.root, Resources.manifestFile), Resources.textEncoding));
    const tools: unknown = InstalledPackage.field(manifest, Resources.devDependenciesField);
    const version: unknown = InstalledPackage.field(tools, Resources.nodeTypesPackage);
    return Object.isString(version) ? version : null;
  }

  private static field(value: unknown, name: string): unknown {
    return Object.isObject(value) && !Array.isArray(value) ? Object.fromEntries(Object.entries(value))[name] : undefined;
  }

  public async runAsync(): Promise<number> {
    const npmPath: string | undefined = process.env[Resources.npmPathVariable];
    if (Object.isUndefined(npmPath) || npmPath.length === 0) {
      console.error(Resources.npmUnavailable);
      return 1;
    }
    const archives: readonly string[] = await InstalledPackage.listAsync(path.join(InstalledPackage.root, Resources.archivesFolder), Resources.installedArchivePrefix);
    if (archives.length !== Resources.packageFolders.length) {
      console.error(Resources.installedArchivesMissing);
      return 1;
    }
    const typesVersion: string | null = await InstalledPackage.readTypesVersionAsync();
    if (Object.isNull(typesVersion)) {
      console.error(Resources.installedNodeTypesMissing);
      return 1;
    }
    const variable: string | undefined = process.env[Resources.runnerTempVariable];
    const work: string = Object.isUndefined(variable) || variable.length === 0 ? await mkdtemp(path.join(tmpdir(), Resources.installedWorkPrefix)) : variable;
    const isOwnFolder: boolean = work !== variable;
    try {
      return await this.installAndOpenAsync(work, npmPath, archives, typesVersion);
    }
    finally {
      if (isOwnFolder)
        await rm(work, { recursive: true, force: true });
    }
  }

  private async installAndOpenAsync(work: string, npmPath: string, archives: readonly string[], typesVersion: string): Promise<number> {
    const app: string = await InstalledPackage.emptyAsync(path.join(work, Resources.installedAppFolder));
    const peers: string = await InstalledPackage.emptyAsync(path.join(work, Resources.installedPeersFolder));
    for (const name of Resources.installedPeers) {
      const result = await this.npm.runAsync([...Resources.installedPackArguments, path.join(InstalledPackage.root, Resources.modulesFolder, ...name.split(Resources.posixSeparator))], peers);
      if (!result.isSuccessful) {
        console.error(`${result.text}${Resources.lineEnd}${Resources.installedPeersMissing}`);
        return 1;
      }
    }
    const packed: readonly string[] = await InstalledPackage.listAsync(peers, "");
    if (packed.length !== Resources.installedPeers.length) {
      console.error(Resources.installedPeersMissing);
      return 1;
    }
    for (const file of Resources.installedAppFiles)
      await copyFile(path.join(import.meta.dirname, file), path.join(app, file));
    await writeFile(path.join(app, Resources.manifestFile), Resources.installedAppManifest);
    const installArguments: readonly string[] = [npmPath, ...Resources.installedInstallArguments, ...archives, ...packed, Resources.formatNodeTypes(typesVersion)];
    const installed: number = await this.runner.runAsync(process.execPath, installArguments, app);
    if (installed !== 0)
      return installed;
    await writeFile(path.join(app, Resources.installedServiceModule), Resources.installedServiceSource);
    const compiler: string = path.join(InstalledPackage.root, ...Resources.typeScriptCompiler);
    const compiled: number = await this.runner.runAsync(process.execPath,
      [compiler, ...Resources.installedCompileArguments, Resources.installedServiceModule, Resources.installedOpenScript], app);
    if (compiled !== 0)
      return compiled;
    process.stdout.write(Resources.installedCompiled);
    return await this.runner.runAsync(process.execPath, [Resources.installedOpenScript], app);
  }
}

try {
  process.exitCode = await new InstalledPackage().runAsync();
}
catch (error) {
  if (!(error instanceof ProcessException))
    throw error;
  console.error(error.message);
  process.exitCode = 1;
}
