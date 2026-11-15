/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { VersionRange } from "../models/version-range.ts";
import { Resources } from "../resources.ts";

type JsonObject = { readonly [key: string]: unknown };

class DeclarationCheck {
  private readonly root: string;
  private readonly problems: string[] = [];

  public constructor(root: string) {
    this.root = root;
  }

  public run(): readonly string[] {
    const packageRoot: string = join(this.root, Resources.moduleFolder);
    const declaration: JsonObject | null = this.readObject(join(packageRoot, Resources.moduleFile));
    const packageManifest: JsonObject | null = this.readObject(join(packageRoot, Resources.manifestFile));
    const windowManifest: JsonObject | null = this.readObject(join(this.root, Resources.windowFolder, Resources.manifestFile));
    const rootManifest: JsonObject | null = this.readObject(join(this.root, Resources.manifestFile));
    if (declaration !== null)
      this.checkDeclaration(declaration);
    if (packageManifest !== null)
      this.checkPackageManifest(packageManifest);
    const desktopCore: VersionRange | null = declaration === null ? null : this.readDesktopCore(declaration);
    if (packageManifest !== null && windowManifest !== null && rootManifest !== null)
      this.checkPins(packageManifest, windowManifest, rootManifest, desktopCore);
    return this.problems;
  }

  private checkDeclaration(declaration: JsonObject): void {
    const fields: readonly string[] = Object.keys(declaration);
    if (fields.length !== Resources.moduleFields.length || Resources.moduleFields.some(t => !fields.includes(t)))
      this.problems.push(Resources.moduleFieldsInvalid);
    const id: unknown = declaration[Resources.idField];
    if (typeof id !== "string" || !Resources.idPattern.test(id) || id === Resources.reservedModuleId) {
      this.problems.push(Resources.moduleIdInvalid);
      return;
    }
    const version: unknown = declaration[Resources.versionField];
    if (typeof version !== "string" || !Resources.versionPattern.test(version))
      this.problems.push(Resources.moduleVersionInvalid);
    if (declaration[Resources.pseudoTerminalsField] !== true)
      this.problems.push(Resources.pseudoTerminalsRequired);
    for (const field of Resources.textFields) {
      const value: unknown = declaration[field];
      if (typeof value !== "string" || value.trim() === "")
        this.problems.push(Resources.formatModuleTextBlank(field));
    }
    for (const part of this.readTexts(declaration, Resources.partsField)) {
      const folder: string | undefined = Resources.partFolders.get(part);
      if (folder === undefined)
        this.problems.push(Resources.formatModulePartUnknown(part));
      else if (!existsSync(join(this.root, folder)))
        this.problems.push(Resources.formatModulePartFolderMissing(part, folder));
    }
    this.checkDependencies(declaration[Resources.dependenciesField], id);
    this.checkContributions(declaration[Resources.contributesField], id);
  }

  private checkDependencies(dependencies: unknown, id: string): void {
    if (!DeclarationCheck.isObject(dependencies)) {
      this.problems.push(Resources.moduleDependenciesInvalid);
      return;
    }
    for (const [dependency, version] of Object.entries(dependencies)) {
      if (!Resources.idPattern.test(dependency) || dependency === id)
        this.problems.push(Resources.formatModuleDependencyInvalid(dependency));
      else if (typeof version !== "string" || !Resources.versionPattern.test(version))
        this.problems.push(Resources.formatModuleDependencyVersionInvalid(dependency));
    }
  }

  private checkContributions(contributes: unknown, id: string): void {
    if (!DeclarationCheck.isObject(contributes)) {
      this.problems.push(Resources.moduleContributesInvalid);
      return;
    }
    for (const kind of Object.keys(contributes)) {
      if (!Resources.contributionKinds.includes(kind)) {
        this.problems.push(Resources.formatModuleKindUnknown(kind));
        continue;
      }
      for (const name of this.readTexts(contributes, kind)) {
        if (kind === Resources.toolsKind) {
          this.checkToolName(name, id);
          continue;
        }
        const [owner, local, ...rest] = name.split(Resources.versionSeparator);
        if (owner !== id || local === undefined || !Resources.namePattern.test(local) || rest.length > 0)
          this.problems.push(Resources.formatModuleContributionInvalid(kind, name, id));
      }
    }
  }

  private checkToolName(name: string, id: string): void {
    const prefix: string = Resources.formatToolPrefix(id);
    if (!Resources.toolPattern.test(name) || !name.startsWith(prefix) || name.length === prefix.length)
      this.problems.push(Resources.formatToolNameInvalid(name, prefix));
  }

  private checkPackageManifest(packageManifest: JsonObject): void {
    if (packageManifest[Resources.nameField] !== Resources.modulePackageName)
      this.problems.push(Resources.packageNameRequired);
    if (packageManifest[Resources.versionField] !== Resources.versionPlaceholder)
      this.problems.push(Resources.packageVersionRequired);
    if (packageManifest[Resources.privateField] !== undefined)
      this.problems.push(Resources.packagePrivate);
  }

  private readDesktopCore(declaration: JsonObject): VersionRange | null {
    const text: unknown = declaration[Resources.desktopCoreField];
    const range: VersionRange | null = typeof text === "string" ? VersionRange.parse(text) : null;
    if (range === null || range.toString() !== VersionRange.from(range.lowest).toString()) {
      this.problems.push(Resources.desktopCoreInvalid);
      return null;
    }
    return range;
  }

  private checkPins(packageManifest: JsonObject, windowManifest: JsonObject, rootManifest: JsonObject, desktopCore: VersionRange | null): void {
    const builtAgainst: JsonObject[] = [];
    for (const field of Resources.dependencyFields.slice(1)) {
      if (field !== Resources.peersField)
        this.readPins(packageManifest, field, Resources.packageManifest);
      const pins: JsonObject = this.readPins(rootManifest, field, Resources.rootManifest);
      if (field === Resources.devDependenciesField)
        builtAgainst.push(pins);
    }
    this.checkPeers(packageManifest, desktopCore);
    this.readPins(packageManifest, Resources.dependenciesField, Resources.packageManifest);
    this.readPins(windowManifest, Resources.dependenciesField, Resources.windowPackageManifest);
    const windowPins: JsonObject = this.readPins(windowManifest, Resources.devDependenciesField, Resources.windowPackageManifest);
    for (const [name, pin] of [...builtAgainst, windowPins].flatMap(t => Object.entries(t)))
      if (VersionRange.isCore(name) && desktopCore !== null && typeof pin === "string" && !desktopCore.includes(pin))
        this.problems.push(Resources.formatCoreBuildOutsideRange(name, pin, desktopCore.toString()));
    for (const name of Object.keys(this.readPins(rootManifest, Resources.dependenciesField, Resources.rootManifest)))
      this.problems.push(Resources.formatRootDependencyPinned(name));
  }

  private checkPeers(packageManifest: JsonObject, desktopCore: VersionRange | null): void {
    const peers: unknown = packageManifest[Resources.peersField] ?? {};
    if (!DeclarationCheck.isObject(peers)) {
      this.problems.push(Resources.packagePeersInvalid);
      return;
    }
    for (const [name, needed] of Object.entries(peers)) {
      const text: string = typeof needed === "string" ? needed : "";
      if (VersionRange.isCore(name)) {
        if (desktopCore !== null && text !== desktopCore.toString())
          this.problems.push(Resources.formatPackageCorePeerDiffers(name, desktopCore.toString()));
      }
      else if (!Resources.declarationPinPattern.test(text) && !(VersionRange.isRanged(name) && VersionRange.parse(text) !== null))
        this.problems.push(Resources.formatPackagePeerPinInvalid(name, VersionRange.isRanged(name)));
    }
  }

  private readPins(manifest: JsonObject, field: string, description: string): JsonObject {
    const dependencies: unknown = manifest[field] ?? {};
    if (!DeclarationCheck.isObject(dependencies)) {
      this.problems.push(Resources.formatFieldNotObject(description, field));
      return {};
    }
    for (const [name, version] of Object.entries(dependencies)) {
      if (name.startsWith(Resources.ownPackagePrefix) ? version !== Resources.ownPin : typeof version !== "string" || !Resources.declarationPinPattern.test(version))
        this.problems.push(name.startsWith(Resources.ownPackagePrefix)
          ? Resources.formatManifestOwnPinInvalid(description, name, field)
          : Resources.formatManifestPinInvalid(description, name, field));
    }
    return dependencies;
  }

  private readTexts(owner: JsonObject, field: string): readonly string[] {
    const values: unknown = owner[field];
    if (!Array.isArray(values) || values.some(t => typeof t !== "string")) {
      this.problems.push(Resources.formatModuleListInvalid(field));
      return [];
    }
    if (new Set(values).size !== values.length)
      this.problems.push(Resources.formatModuleListRepeats(field));
    return values;
  }

  private readObject(path: string): JsonObject | null {
    let value: unknown;
    try {
      value = JSON.parse(readFileSync(path, Resources.textEncoding));
    }
    catch (error) {
      this.problems.push(Resources.formatReadFailed(path, error));
      return null;
    }
    if (DeclarationCheck.isObject(value))
      return value;
    this.problems.push(Resources.formatObjectRequired(path));
    return null;
  }

  private static isObject(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}

const problems: readonly string[] = new DeclarationCheck(process.cwd()).run();
for (const problem of problems)
  console.error(problem);
process.exitCode = problems.length > 0 ? 1 : 0;
