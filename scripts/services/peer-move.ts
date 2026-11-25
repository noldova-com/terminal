/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { JsonObjectRequiredException } from "../exceptions/json-object-required.exception.ts";
import { PackageException } from "../exceptions/package.exception.ts";
import { PeerManifestUnreadableException } from "../exceptions/peer-manifest-unreadable.exception.ts";
import { PeerVersionsNotJsonException } from "../exceptions/peer-versions-not-json.exception.ts";
import { ProcessException } from "../exceptions/process.exception.ts";
import { VersionMissingException } from "../exceptions/version-missing.exception.ts";
import { RootManifest } from "../models/root-manifest.ts";
import { VersionRange } from "../models/version-range.ts";
import { Resources } from "../resources.ts";
import type { NpmCommand } from "./npm-command.ts";
import type { PackageLayout } from "./package-layout.ts";

export class PeerMove {
  private readonly layout: PackageLayout;
  private readonly npm: NpmCommand;
  private readonly report: (line: string) => void;
  private readonly root: string;

  public constructor(root: string, layout: PackageLayout, npm: NpmCommand, report: (line: string) => void) {
    this.layout = layout;
    this.npm = npm;
    this.report = report;
    this.root = root;
  }

  public async runAsync(): Promise<number> {
    try {
      const chosen = new Map<string, string>();
      for (const [name, ranges] of await this.readRangesAsync()) {
        const version = await this.newestAsync(name, ranges);
        if (Object.isUndefined(version))
          return 1;
        chosen.set(name, version);
      }
      if (chosen.size === 0)
        return 0;
      const manifest = RootManifest.parse(await readFile(path.join(this.root, Resources.manifestFile), Resources.textEncoding));
      const context = [...chosen].filter(([name]) => name.startsWith(Resources.contextPrefix)).map(([, version]) => version);
      const together = context.reduce<string | undefined>((found, t) => Object.isUndefined(found) || PeerMove.isNewer(t, found) ? t : found, undefined);
      if (!Object.isUndefined(together))
        for (const name of new Set([...manifest.pins.keys(), ...await this.readInstalledContextAsync()]))
          if (name.startsWith(Resources.contextPrefix) && !chosen.has(name))
            chosen.set(name, together);
      const kept = await this.readInstalledPinsAsync(new Map([...manifest.pins].filter(([name]) => !chosen.has(name))));
      const moved = [...chosen].map(([name, version]) => Resources.formatPackageSpec(name, version));
      const result = await this.npm.runAsync([...Resources.peerInstallArguments, ...moved, ...kept], this.root);
      if (!result.isSuccessful) {
        this.report(Resources.formatPeerMoveFailed(result.exitCode, result.text));
        return 1;
      }
      let failed = 0;
      for (const [name, version] of chosen) {
        const installed = await this.readInstalledAsync(name);
        if (installed === version)
          this.report(Resources.formatPeerMoved(name, version));
        else {
          this.report(Resources.formatPeerNotMoved(name, String(installed), version));
          failed++;
        }
      }
      return failed === 0 ? 0 : 1;
    }
    catch (error) {
      if (!(error instanceof ProcessException || error instanceof PackageException))
        throw error;
      this.report(error.message);
      return 1;
    }
  }

  private static isNewer(version: string, than: string): boolean {
    return !Object.isNull(VersionRange.parse(Resources.formatRange(than, version)));
  }

  private static fieldsOf(json: unknown): ReadonlyMap<string, unknown> {
    return Object.isObject(json) && !Array.isArray(json) ? new Map<string, unknown>(Object.entries(json)) : new Map<string, unknown>();
  }

  private static parseVersions(name: string, output: string): unknown {
    try {
      return JSON.parse(output);
    }
    catch (error) {
      if (!(error instanceof SyntaxError))
        throw error;
      throw new PeerVersionsNotJsonException(name, output, error);
    }
  }

  private static installedFile(root: string, name: string): string {
    return path.join(root, Resources.modulesFolder, ...name.split(Resources.posixSeparator), Resources.manifestFile);
  }

  private async readRangesAsync(): Promise<ReadonlyMap<string, readonly string[]>> {
    const ranges = new Map<string, string[]>();
    for (const part of await this.layout.readPackagesAsync()) {
      const manifest: unknown = JSON.parse(await readFile(path.join(this.root, part.folder, Resources.manifestFile), Resources.textEncoding));
      for (const [name, range] of PeerMove.fieldsOf(PeerMove.fieldsOf(manifest).get(Resources.peersField)))
        if (VersionRange.isRanged(name) && !VersionRange.isCore(name) && Object.isString(range))
          ranges.set(name, [...ranges.get(name) ?? [], range]);
    }
    return ranges;
  }

  private async newestAsync(name: string, ranges: readonly string[]): Promise<string | undefined> {
    const parsed = ranges.map(t => VersionRange.parse(t));
    const holding = parsed.filter(t => !Object.isNull(t));
    if (holding.length !== parsed.length) {
      for (const range of ranges.filter(t => Object.isNull(VersionRange.parse(t))))
        this.report(Resources.formatPeerRangeInvalid(Resources.manifestFile, name, range));
      return undefined;
    }
    const result = await this.npm.runAsync([Resources.peerViewCommand, name, Resources.peerVersionsField, Resources.peerJsonOption], this.root);
    if (!result.isSuccessful) {
      this.report(Resources.formatPeerVersionsUnread(name, result.exitCode, result.text));
      return undefined;
    }
    const published = PeerMove.parseVersions(name, result.output);
    const versions = (Array.isArray(published) ? published : [published])
      .filter((t: unknown): t is string => Object.isString(t) && Resources.versionPattern.test(t) && holding.every(u => u.includes(t)));
    const newest = versions.reduce<string | undefined>((found, t) => Object.isUndefined(found) || PeerMove.isNewer(t, found) ? t : found, undefined);
    if (Object.isUndefined(newest))
      this.report(Resources.formatPeerNoVersion(name, [...new Set(ranges)]));
    return newest;
  }

  private async readInstalledContextAsync(): Promise<readonly string[]> {
    const [scope = "", prefix = ""] = Resources.contextPrefix.split(Resources.posixSeparator);
    const folder = path.join(this.root, Resources.modulesFolder, scope);
    if (!existsSync(folder))
      return [];
    return (await readdir(folder)).filter(t => t.startsWith(prefix)).map(t => `${scope}${Resources.posixSeparator}${t}`);
  }

  private async readInstalledPinsAsync(pins: ReadonlyMap<string, string>): Promise<readonly string[]> {
    const kept: string[] = [];
    for (const name of [...pins.keys()].filter(t => t.startsWith(Resources.peerScopePrefix))) {
      const file = PeerMove.installedFile(this.root, name);
      if (!existsSync(file))
        continue;
      const installed: unknown = JSON.parse(await readFile(file, Resources.textEncoding));
      if (!Object.isObject(installed) || Array.isArray(installed))
        throw new JsonObjectRequiredException(file);
      const version = PeerMove.fieldsOf(installed).get(Resources.versionField);
      if (!Object.isString(version))
        throw new VersionMissingException(file);
      kept.push(Resources.formatPackageSpec(name, version));
    }
    return kept;
  }

  private async readInstalledAsync(name: string): Promise<unknown> {
    const file = PeerMove.installedFile(this.root, name);
    try {
      return PeerMove.fieldsOf(JSON.parse(await readFile(file, Resources.textEncoding))).get(Resources.versionField);
    }
    catch (error) {
      if (!(error instanceof SyntaxError || error instanceof Error && "code" in error && String(error.code) === Resources.missingCode))
        throw error;
      throw new PeerManifestUnreadableException(name, file, error);
    }
  }
}
