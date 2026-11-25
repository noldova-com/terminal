/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AngularPackageBuilder } from "../../src/noldova.terminal.window/scripts/angular-package-builder.ts";
import { ArchiveInstallFailedException } from "../exceptions/archive-install-failed.exception.ts";
import { CompileFailedException } from "../exceptions/compile-failed.exception.ts";
import { CompiledMissingException } from "../exceptions/compiled-missing.exception.ts";
import { ExportSourceInvalidException } from "../exceptions/export-source-invalid.exception.ts";
import { ExportsInvalidException } from "../exceptions/exports-invalid.exception.ts";
import { FieldNotObjectException } from "../exceptions/field-not-object.exception.ts";
import { GitHubException } from "../exceptions/github.exception.ts";
import { JsonObjectRequiredException } from "../exceptions/json-object-required.exception.ts";
import { ModuleVersionDiffersException } from "../exceptions/module-version-differs.exception.ts";
import { OwnPinInvalidException } from "../exceptions/own-pin-invalid.exception.ts";
import { PackFailedException } from "../exceptions/pack-failed.exception.ts";
import { PackagePrivateException } from "../exceptions/package-private.exception.ts";
import { PackageException } from "../exceptions/package.exception.ts";
import { VersionMissingException } from "../exceptions/version-missing.exception.ts";
import { VersionPlaceholderMissingException } from "../exceptions/version-placeholder-missing.exception.ts";
import { PackageCopy } from "../models/package-copy.ts";
import type { ProcessResult } from "../models/process-result.ts";
import { Resources } from "../resources.ts";
import { ArchiveCheck } from "./archive-check.ts";
import { Git } from "./git.ts";
import type { NpmCommand } from "./npm-command.ts";
import { PackageImports } from "./package-imports.ts";
import { PackageLayout } from "./package-layout.ts";
import type { ProcessRunner } from "./process-runner.ts";

type JsonObject = { readonly [key: string]: unknown };

export class PackagePacker {
  private readonly root: string;
  private readonly npm: NpmCommand;
  private readonly runner: ProcessRunner;
  private readonly angular: AngularPackageBuilder;
  private readonly report: (line: string) => void;

  public constructor(root: string, npm: NpmCommand, runner: ProcessRunner, angular: AngularPackageBuilder, report: (line: string) => void) {
    this.root = root;
    this.npm = npm;
    this.runner = runner;
    this.angular = angular;
    this.report = report;
  }

  public async runAsync(): Promise<number> {
    try {
      const version = await this.readVersionAsync();
      await this.checkModuleVersionAsync(version);
      const commit = await this.readCommitAsync();
      await rm(path.join(this.root, Resources.archivesFolder), { recursive: true, force: true });
      await this.compileAsync(Resources.protocolProject);
      await this.packProtocolAsync(version, commit);
      await this.installArchivesAsync();
      await this.packWindowAsync(version, commit);
      await this.installArchivesAsync();
      await this.compileAsync(Resources.moduleProject);
      await this.packModuleAsync(version, commit);
      await this.installArchivesAsync();
      await new ArchiveCheck(this.root).checkAsync(Resources.archivesFolder, version, commit, Resources.scope);
      return 0;
    }
    catch (error) {
      if (!(error instanceof PackageException || error instanceof GitHubException))
        throw error;
      this.report(error.message);
      return 1;
    }
  }

  public async listCopiesAsync(): Promise<readonly PackageCopy[]> {
    const copies: PackageCopy[] = [];
    for (const part of await new PackageLayout(this.root).readPackagesAsync()) {
      copies.push(new PackageCopy(Resources.licenseFile, part.name, Resources.licenseFile));
      copies.push(new PackageCopy(path.posix.join(part.folder, Resources.readmeFile), part.name, Resources.readmeFile));
      if (part.folder === Resources.moduleFolder)
        copies.push(...this.listModuleFiles().map(t => new PackageCopy(path.posix.join(Resources.moduleFolder, t), part.name, t)));
    }
    return copies;
  }

  private static manifestOf(manifest: JsonObject, file: string): JsonObject {
    const exports: unknown = manifest[Resources.exportsField];
    if (typeof exports !== "object" || exports === null || Array.isArray(exports))
      throw new ExportsInvalidException(file);
    const mapped = Object.entries(exports).map(([subpath, target]) => {
      if (target === Resources.manifestExport)
        return [subpath, target] as const;
      if (typeof target !== "string" || !target.endsWith(Resources.sourceExtension) || target.endsWith(Resources.declarationExtension))
        throw new ExportSourceInvalidException(file, subpath);
      const stem = target.slice(0, -Resources.sourceExtension.length);
      return [subpath, { types: `${stem}${Resources.declarationExtension}`, default: `${stem}${Resources.scriptExtension}` }] as const;
    });
    return { ...manifest, [Resources.exportsField]: Object.fromEntries(mapped) };
  }

  private static readPins(manifest: JsonObject, file: string, field: string): ReadonlyMap<string, unknown> {
    const pins: unknown = manifest[field] ?? {};
    if (typeof pins !== "object" || pins === null || Array.isArray(pins))
      throw new FieldNotObjectException(file, field);
    return new Map(Object.entries(pins));
  }

  private static readTexts(manifest: JsonObject, file: string, field: string): ReadonlyMap<string, string> {
    return new Map([...PackagePacker.readPins(manifest, file, field)].filter((t): t is [string, string] => typeof t[1] === "string"));
  }

  private static require(result: ProcessResult, packageName: string): void {
    if (!result.isSuccessful)
      throw new PackFailedException(packageName, result.exitCode, result.text);
  }

  private async packProtocolAsync(version: string, commit: string | null): Promise<void> {
    const folder = Resources.protocolFolder;
    const output = this.locateWork(folder);
    await rm(output, { recursive: true, force: true });
    await this.copyCompiledAsync(path.posix.basename(folder), path.join(output, Resources.sourceFolder));
    await this.copyDeclarationsAsync(path.join(this.root, folder, Resources.sourceFolder), path.join(output, Resources.sourceFolder));
    const file = path.posix.join(folder, Resources.manifestFile);
    await this.finishAsync(folder, output, PackagePacker.manifestOf(await this.readManifestAsync(file, version), file), commit);
  }

  private async packWindowAsync(version: string, commit: string | null): Promise<void> {
    const folder = Resources.windowFolder;
    const output = this.locateWork(folder);
    await rm(output, { recursive: true, force: true });
    const sources = path.join(this.root, folder, Resources.sourceFolder);
    const protocol = path.join(this.locateWork(Resources.protocolFolder), Resources.sourceFolder, Resources.apiFolder, Resources.entryDeclaration);
    await this.angular.compileAsync(path.join(this.root, folder), sources, path.join(output, Resources.sourceFolder), new Map([[Resources.protocolPackageName, protocol]]));
    await this.copyDeclarationsAsync(sources, path.join(output, Resources.sourceFolder));
    const file = path.posix.join(folder, Resources.manifestFile);
    const manifest = await this.readManifestAsync(file, version);
    const [dependencies, peers] = await PackageImports.resolveAsync(path.join(output, Resources.sourceFolder),
      PackagePacker.readTexts(manifest, file, Resources.dependenciesField), PackagePacker.readTexts(manifest, file, Resources.peersField), version, file);
    const meta = PackagePacker.readPins(manifest, file, Resources.peersMetaField);
    const { dependencies: _, devDependencies: __, scripts: ___, allowScripts: ____, peerDependencies: _____, peerDependenciesMeta: ______, ...published } = manifest;
    const sorted = (pins: ReadonlyMap<string, unknown>): JsonObject => Object.fromEntries([...pins].sort(([a], [b]) => a.localeCompare(b)));
    await this.finishAsync(folder, output, PackagePacker.manifestOf({
      ...published,
      dependencies: sorted(dependencies),
      peerDependencies: sorted(peers),
      peerDependenciesMeta: sorted(new Map([...meta].filter(([name]) => peers.has(name))))
    }, file), commit);
  }

  private async packModuleAsync(version: string, commit: string | null): Promise<void> {
    const source = path.join(this.root, Resources.moduleFolder);
    const output = this.locateWork(Resources.moduleFolder);
    await rm(output, { recursive: true, force: true });
    await mkdir(output, { recursive: true });
    for (const file of this.listModuleFiles())
      await copyFile(path.join(source, file), path.join(output, file));
    const sources = path.join(output, Resources.sourceFolder);
    await this.copyCompiledAsync(path.posix.basename(Resources.moduleFolder), sources);
    await this.copyDeclarationsAsync(path.join(source, Resources.sourceFolder), sources);
    const window = path.join(Resources.sourceFolder, Resources.apiFolder, Resources.windowEntry);
    const { default: typescript } = await import("typescript");
    const options = { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2025, verbatimModuleSyntax: true };
    const script = typescript.transpileModule(await readFile(path.join(source, window), Resources.textEncoding), { compilerOptions: options }).outputText;
    await writeFile(path.join(output, `${window.slice(0, -Resources.sourceExtension.length)}${Resources.scriptExtension}`), script);
    const file = path.posix.join(Resources.moduleFolder, Resources.manifestFile);
    const manifest = await this.readManifestAsync(file, version);
    const pins = PackagePacker.readTexts(manifest, file, Resources.dependenciesField);
    for (const [name, pin] of [...pins].filter(([t]) => t.startsWith(Resources.ownPackagePrefix)))
      if (pin !== Resources.ownPin)
        throw new OwnPinInvalidException(file, name, pin);
    const stamped = new Map([...pins].map(([name, pin]): [string, string] => [name, name.startsWith(Resources.ownPackagePrefix) ? version : pin]));
    await this.finishAsync(Resources.moduleFolder, output, PackagePacker.manifestOf({ ...manifest, [Resources.dependenciesField]: Object.fromEntries(stamped) }, file), commit);
  }

  private async copyCompiledAsync(part: string, target: string): Promise<void> {
    const compiled = path.join(this.root, ...Resources.compiledSegments, part, Resources.sourceFolder);
    if (!existsSync(compiled))
      throw new CompiledMissingException(path.posix.join(...Resources.compiledSegments, part, Resources.sourceFolder));
    for (const file of (await readdir(compiled, { recursive: true })).filter(t => t.endsWith(Resources.scriptExtension))) {
      await mkdir(path.dirname(path.join(target, file)), { recursive: true });
      await copyFile(path.join(compiled, file), path.join(target, file));
    }
  }

  private async copyDeclarationsAsync(sources: string, target: string): Promise<void> {
    for (const file of (await readdir(sources, { recursive: true })).filter(t => t.endsWith(Resources.declarationExtension))) {
      await mkdir(path.dirname(path.join(target, file)), { recursive: true });
      const text = await readFile(path.join(sources, file), Resources.textEncoding);
      await writeFile(path.join(target, file), text.replace(Resources.declarationImportPattern, Resources.declarationImportReplacement));
    }
  }

  private async compileAsync(project: string): Promise<void> {
    const exitCode = await this.runner.runAsync(process.execPath, [path.join(this.root, ...Resources.typeScriptCompiler), Resources.projectOption, project], this.root);
    if (exitCode !== 0)
      throw new CompileFailedException(project, exitCode);
  }

  private async installArchivesAsync(): Promise<void> {
    const archives = (await readdir(path.join(this.root, Resources.archivesFolder))).filter(t => t.endsWith(Resources.archiveExtension)).sort()
      .map(t => `./${Resources.archivesFolder}/${t}`);
    const result = await this.npm.runAsync([...Resources.peerInstallArguments, ...archives, ...await this.readInstalledNoldovaAsync()], this.root);
    if (!result.isSuccessful)
      throw new ArchiveInstallFailedException(result.exitCode, result.text);
  }

  private async readInstalledNoldovaAsync(): Promise<readonly string[]> {
    const folder = path.join(this.root, Resources.modulesFolder, Resources.scope);
    if (!existsSync(folder))
      return [];
    const kept: string[] = [];
    for (const name of (await readdir(folder)).sort()) {
      const packageName = `${Resources.peerScopePrefix}${name}`;
      const file = path.join(folder, name, Resources.manifestFile);
      if (packageName === Resources.modulePackageName || packageName.startsWith(Resources.ownPackagePrefix) || !existsSync(file))
        continue;
      const version: unknown = (await this.readJsonAsync(path.relative(this.root, file)))[Resources.versionField];
      if (typeof version !== "string")
        throw new VersionMissingException(path.relative(this.root, file));
      kept.push(Resources.formatPackageSpec(packageName, version));
    }
    return kept;
  }

  private async finishAsync(folder: string, output: string, manifest: JsonObject, commit: string | null): Promise<void> {
    await mkdir(output, { recursive: true });
    await copyFile(path.join(this.root, Resources.licenseFile), path.join(output, Resources.licenseFile));
    await copyFile(path.join(this.root, folder, Resources.readmeFile), path.join(output, Resources.readmeFile));
    const stamped: JsonObject = commit === null ? manifest : { ...manifest, [Resources.commitField]: commit };
    await writeFile(path.join(output, Resources.manifestFile), `${JSON.stringify(stamped, null, Resources.jsonIndent)}${Resources.lineFeed}`);
    const archives = path.join(this.root, Resources.archivesFolder);
    await mkdir(archives, { recursive: true });
    PackagePacker.require(await this.npm.runAsync([...Resources.packArguments, archives], output), String(manifest[Resources.nameField]));
  }

  private listModuleFiles(): readonly string[] {
    return Resources.moduleFiles.filter(t => existsSync(path.join(this.root, Resources.moduleFolder, t)));
  }

  private async readCommitAsync(): Promise<string | null> {
    if (!existsSync(path.join(this.root, Resources.gitFolder)))
      return null;
    const git = new Git(this.root, this.runner);
    if ((await git.readOutputAsync(Resources.statusArguments)).length > 0)
      return null;
    return (await git.readOutputAsync(Resources.commitArguments)).trim();
  }

  private async readVersionAsync(): Promise<string> {
    const version: unknown = (await this.readJsonAsync(Resources.versionFile))[Resources.versionField];
    if (typeof version !== "string")
      throw new VersionMissingException(Resources.versionFile);
    return version;
  }

  private async checkModuleVersionAsync(version: string): Promise<void> {
    const file = path.posix.join(Resources.moduleFolder, Resources.moduleFile);
    const found: unknown = (await this.readJsonAsync(file))[Resources.versionField];
    if (found !== version)
      throw new ModuleVersionDiffersException(file, String(found), version);
  }

  private async readManifestAsync(file: string, version: string): Promise<JsonObject> {
    const manifest = await this.readJsonAsync(file);
    if (manifest[Resources.versionField] !== Resources.versionPlaceholder)
      throw new VersionPlaceholderMissingException(file, String(manifest[Resources.versionField]));
    if (manifest[Resources.privateField] !== undefined)
      throw new PackagePrivateException(file);
    return { ...manifest, version };
  }

  private async readJsonAsync(file: string): Promise<JsonObject> {
    const json: unknown = JSON.parse(await readFile(path.join(this.root, file), Resources.textEncoding));
    if (typeof json !== "object" || json === null || Array.isArray(json))
      throw new JsonObjectRequiredException(file);
    return Object.fromEntries(Object.entries(json));
  }

  private locateWork(folder: string): string {
    return path.join(this.root, ...Resources.workSegments, path.posix.basename(folder));
  }
}
