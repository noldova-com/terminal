/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { ArchiveFindingsException } from "../exceptions/archive-findings.exception.ts";
import { ArchiveFolderMissingException } from "../exceptions/archive-folder-missing.exception.ts";
import { GitHubObjectExpectedException } from "../exceptions/github-object-expected.exception.ts";
import { JsonObjectUnreadableException } from "../exceptions/json-object-unreadable.exception.ts";
import { ReleaseArchive } from "../models/release-archive.ts";
import { ArchiveReader } from "./archive-reader.ts";
import { VersionRange } from "../models/version-range.ts";
import { GitHubJson } from "./github-json.ts";
import { PackageLayout } from "./package-layout.ts";
import { Resources } from "../resources.ts";

export class ArchiveCheck {
  private readonly root: string;
  private readonly archiveReader: ArchiveReader = new ArchiveReader();

  public constructor(root: string) {
    this.root = root;
  }

  public async checkAsync(folder: string, version: string, commit: string | null, scope: string): Promise<readonly ReleaseArchive[]> {
    const directory = path.resolve(this.root, folder);
    if (!existsSync(directory))
      throw new ArchiveFolderMissingException(folder);

    const archives = (await new PackageLayout(this.root).readPackagesAsync()).map(t => new ReleaseArchive(t, path.join(directory, Resources.formatArchiveName(t.name, version))));
    const expected = archives.map(t => path.basename(t.filePath));
    const found = (await readdir(directory)).sort();
    const findings = [
      ...expected.filter(t => !found.includes(t)).map(t => Resources.formatArchiveMissing(folder, t)),
      ...found.filter(t => !expected.includes(t)).map(t => Resources.formatArchiveUnexpected(folder, t, version))
    ];

    const names = archives.map(t => t.part.name);
    const contents = new Map<ReleaseArchive, ReadonlyMap<string, Buffer>>();
    for (const archive of archives.filter(t => found.includes(path.basename(t.filePath))))
      contents.set(archive, await this.archiveReader.readAsync(archive.filePath));
    const [desktopCore, rangeFindings] = ArchiveCheck.readDesktopCore(contents);
    findings.push(...rangeFindings);
    for (const [archive, entries] of contents)
      findings.push(...ArchiveCheck.checkArchive(archive, entries, version, commit, scope, names, desktopCore, await this.readBuildPinsAsync(archive)));

    if (findings.length > 0)
      throw new ArchiveFindingsException(findings);

    return archives;
  }

  private static readDesktopCore(contents: ReadonlyMap<ReleaseArchive, ReadonlyMap<string, Buffer>>): readonly [string | null, readonly string[]] {
    const findings: string[] = [];
    const ranges = new Set<string>();
    for (const [archive, entries] of contents) {
      const content = entries.get(Resources.moduleEntryName);
      if (content === undefined)
        continue;
      const archiveName = path.basename(archive.filePath);
      let field: unknown;
      try {
        field = GitHubJson.object(JSON.parse(content.toString(Resources.textEncoding)), archiveName)[Resources.desktopCoreField];
      }
      catch (error) {
        if (!(error instanceof SyntaxError || error instanceof GitHubObjectExpectedException))
          throw error;
        findings.push(Resources.formatArchiveModuleFileInvalid(archiveName));
        continue;
      }
      const range = typeof field === "string" ? VersionRange.parse(field) : null;
      if (range === null)
        findings.push(Resources.formatDesktopCoreRangeInvalid(archiveName, field));
      else
        ranges.add(range.toString());
    }
    if (ranges.size > 1)
      findings.push(Resources.formatDesktopCoreRangesDiffer([...ranges]));
    return [findings.length === 0 && ranges.size === 1 ? [...ranges][0] ?? null : null, findings];
  }

  private async readBuildPinsAsync(archive: ReleaseArchive): Promise<Readonly<Record<string, unknown>>> {
    const file = path.posix.join(archive.part.folder, Resources.manifestFile);
    const manifest = ArchiveCheck.parseObject(await readFile(path.join(this.root, file), Resources.textEncoding), file);
    return manifest[Resources.devDependenciesField] === undefined ? {} : GitHubJson.nullableChild(manifest, Resources.devDependenciesField, file) ?? {};
  }

  private static checkArchive(archive: ReleaseArchive, entries: ReadonlyMap<string, Buffer>, version: string, commit: string | null, scope: string, names: readonly string[],
    desktopCore: string | null, buildPins: Readonly<Record<string, unknown>>): readonly string[] {
    const archiveName = path.basename(archive.filePath);
    const content = entries.get(Resources.manifestEntryName);
    if (content === undefined)
      return [Resources.formatArchiveManifestMissing(archiveName)];

    const context = Resources.formatArchiveManifestContext(archiveName);
    const manifest = ArchiveCheck.parseObject(content.toString(Resources.textEncoding), context);
    const findings: string[] = [...ArchiveCheck.checkContents(archiveName, manifest, entries, desktopCore, buildPins)];
    const name = GitHubJson.text(manifest, Resources.nameField, context);
    if (name !== archive.part.name)
      findings.push(Resources.formatArchiveFieldDiffers(archiveName, Resources.nameField, name, archive.part.name));
    if (!name.startsWith(`${scope}${Resources.posixSeparator}`))
      findings.push(Resources.formatArchiveOutsideScope(archiveName, name, scope));

    const foundVersion = GitHubJson.text(manifest, Resources.versionField, context);
    if (foundVersion !== version)
      findings.push(Resources.formatArchiveFieldDiffers(archiveName, Resources.versionField, foundVersion, version));
    if (commit !== null && manifest[Resources.commitField] !== commit)
      findings.push(Resources.formatArchiveCommitDiffers(archiveName, manifest[Resources.commitField], commit));
    if (manifest[Resources.privateField] === true)
      findings.push(Resources.formatArchiveMarkedPrivate(archiveName));

    const dependencies = manifest[Resources.dependenciesField] === undefined ? null : GitHubJson.nullableChild(manifest, Resources.dependenciesField, context);
    if (dependencies !== null)
      for (const dependency of Object.keys(dependencies).filter(t => names.includes(t))) {
        const range = GitHubJson.text(dependencies, dependency, context);
        if (range !== version)
          findings.push(Resources.formatArchiveDependencyDiffers(archiveName, dependency, range, version));
      }

    return findings;
  }

  private static parseObject(text: string, context: string): Readonly<Record<string, unknown>> {
    try {
      return GitHubJson.object(JSON.parse(text), context);
    }
    catch (error) {
      if (!(error instanceof SyntaxError || error instanceof GitHubObjectExpectedException))
        throw error;
      throw new JsonObjectUnreadableException(context, error);
    }
  }

  private static checkContents(archiveName: string, manifest: Readonly<Record<string, unknown>>, entries: ReadonlyMap<string, Buffer>, desktopCore: string | null,
    buildPins: Readonly<Record<string, unknown>>): readonly string[] {
    const findings: string[] = [];
    const exports = manifest[Resources.exportsField];
    const targets = typeof exports === "object" && exports !== null
      ? Object.entries(exports).flatMap(([subpath, target]: [string, unknown]) =>
        (typeof target === "object" && target !== null ? Object.values(target) : [target]).map(t => [subpath, String(t)] as const))
      : [];
    if (targets.length === 0)
      findings.push(Resources.formatArchiveExportsNothing(archiveName));
    for (const [subpath, target] of targets)
      if (!entries.has(path.posix.join(Resources.archiveFolder, target)))
        findings.push(Resources.formatArchiveExportMissing(archiveName, subpath, target));
    if (targets.some(([subpath]) => Resources.partExports.includes(subpath)) && !entries.has(Resources.moduleEntryName))
      findings.push(Resources.formatArchiveModuleFileMissing(archiveName));
    const packageName = manifest[Resources.nameField];
    const isWindow = typeof packageName === "string" && packageName.endsWith(Resources.windowSuffix);
    for (const field of Resources.pinFields) {
      const pins = manifest[field];
      for (const [name, pin] of typeof pins === "object" && pins !== null ? Object.entries(pins) : []) {
        if (desktopCore !== null && field === Resources.peersField && VersionRange.isCore(name)) {
          if (pin !== desktopCore)
            findings.push(Resources.formatCorePeerDiffers(archiveName, name, pin, field, desktopCore));
          continue;
        }
        if (isWindow && field === Resources.peersField && VersionRange.isAngular(name)) {
          const range = typeof pin === "string" ? VersionRange.parse(pin) : null;
          const built = buildPins[name];
          if (range === null || range.toString() !== VersionRange.from(range.lowest).toString())
            findings.push(Resources.formatAngularPeerInvalid(archiveName, name, pin, field));
          else if (range.lowest !== built)
            findings.push(Resources.formatAngularPeerStart(archiveName, name, pin, field, built));
          continue;
        }
        const isRanged = field === Resources.peersField && VersionRange.isRanged(name);
        if (typeof pin !== "string" || !(Resources.archivePinPattern.test(pin) || (isRanged && VersionRange.parse(pin)?.isStandard === true)))
          findings.push(Resources.formatArchivePinInvalid(archiveName, name, pin, field, isRanged));
      }
    }
    if (isWindow) {
      const peers = manifest[Resources.peersField];
      const meta = manifest[Resources.peersMetaField];
      for (const peer of typeof peers === "object" && peers !== null ? Object.keys(peers) : []) {
        const entry: unknown = typeof meta === "object" && meta !== null ? Object.fromEntries(Object.entries(meta))[peer] : undefined;
        if (typeof entry !== "object" || entry === null || Object.fromEntries(Object.entries(entry))[Resources.optionalField] !== true)
          findings.push(Resources.formatArchivePeerNotOptional(archiveName, peer));
      }
    }
    return findings;
  }
}
