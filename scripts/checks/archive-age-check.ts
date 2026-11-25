/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { Resources } from "../resources.ts";

export class ArchiveAgeCheck {
  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public run(): readonly string[] {
    const version: unknown = this.readField(Resources.versionFile, Resources.versionField);
    if (!Object.isString(version))
      return [Resources.formatArchiveAgeVersionMissing(Resources.versionFile)];
    const findings: string[] = [];
    for (const folder of Resources.packageFolders) {
      const manifest: string = path.posix.join(folder, Resources.manifestFile);
      const name: unknown = this.readField(manifest, Resources.nameField);
      if (!Object.isString(name)) {
        findings.push(Resources.formatArchiveAgeNameMissing(manifest));
        continue;
      }
      const archive: string = path.posix.join(Resources.archivesFolder, Resources.formatArchiveName(name, version));
      if (!existsSync(path.join(this.root, archive))) {
        findings.push(Resources.formatArchiveAgeMissing(archive));
        continue;
      }
      const packed: number = statSync(path.join(this.root, archive)).mtimeMs;
      const newer: string | undefined = this.listPackedFiles(folder).find(t => statSync(path.join(this.root, t)).mtimeMs > packed);
      if (!Object.isUndefined(newer))
        findings.push(Resources.formatArchiveAgeStale(archive, newer));
    }
    console.log(Resources.formatArchiveAgeChecked(Resources.packageFolders.length));
    return findings;
  }

  private readField(file: string, field: string): unknown {
    const value: unknown = JSON.parse(readFileSync(path.join(this.root, file), Resources.textEncoding));
    return Object.isObject(value) && !Array.isArray(value) ? Object.fromEntries(Object.entries(value))[field] : undefined;
  }

  private listPackedFiles(folder: string): readonly string[] {
    const files: string[] = [Resources.licenseFile, Resources.baseProjectFile,
      ...[Resources.manifestFile, Resources.readmeFile, Resources.projectFile].map(t => path.posix.join(folder, t))];
    if (folder === Resources.moduleFolder)
      files.push(...Resources.moduleFiles.map(t => path.posix.join(folder, t)).filter(t => existsSync(path.join(this.root, t))));
    const pending: string[] = [path.posix.join(folder, Resources.sourceFolder)];
    for (let current = pending.pop(); !Object.isUndefined(current); current = pending.pop())
      for (const entry of readdirSync(path.join(this.root, current), { withFileTypes: true })) {
        const file: string = path.posix.join(current, entry.name);
        if (entry.isDirectory())
          pending.push(file);
        else if (entry.isFile())
          files.push(file);
      }
    return files;
  }
}

const findings: readonly string[] = new ArchiveAgeCheck(process.cwd()).run();
for (const finding of findings)
  console.error(finding);
process.exitCode = findings.length > 0 ? 1 : 0;
