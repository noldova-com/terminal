/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { Resources } from "../resources.ts";
import { ApiEntryNoExportsException } from "./api-entry-no-exports.exception.ts";
import { ApiEntryNotDeclarationsException } from "./api-entry-not-declarations.exception.ts";
import { ApiEntryUnreadableException } from "./api-entry-unreadable.exception.ts";
import { ApiResources } from "./api.resources.ts";

type JsonObject = { readonly [key: string]: unknown };

export class ApiEntry {
  public static readonly MAIN: ApiEntry = new ApiEntry(ApiResources.mainEntrySubpath, ApiResources.mainEntryName);

  public readonly subpath: string;
  public readonly name: string;

  private constructor(subpath: string, name: string) {
    this.subpath = subpath;
    this.name = name;
  }

  public get isMain(): boolean {
    return this.subpath === ApiEntry.MAIN.subpath;
  }

  public static async readAsync(root: string, directory: string): Promise<readonly ApiEntry[]> {
    const file = [directory, Resources.manifestFile].join(Resources.posixSeparator);
    let manifest: unknown;
    try {
      manifest = JSON.parse(await readFile(path.join(root, file), Resources.textEncoding));
    }
    catch (error) {
      throw new ApiEntryUnreadableException(file, error);
    }
    const exports: unknown = ApiEntry.isObject(manifest) ? manifest[Resources.exportsField] : undefined;
    const listed: readonly (readonly [string, unknown])[] = ApiEntry.isObject(exports) ? Object.entries(exports).filter(([, t]) => !ApiEntry.isAsset(t)) : [];
    if (listed.length === 0)
      throw new ApiEntryNoExportsException(file);
    return listed.map(([subpath, t]) => ApiEntry.parse(file, subpath, t));
  }

  private static isObject(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private static isAsset(target: unknown): boolean {
    return typeof target === "string" && !target.endsWith(Resources.sourceExtension);
  }

  private static parse(file: string, subpath: string, target: unknown): ApiEntry {
    const name = typeof target === "string" ? ApiResources.entrySourcePattern.exec(target)?.[1] : undefined;
    if (name === undefined)
      throw new ApiEntryNotDeclarationsException(file, subpath, JSON.stringify(target));
    return new ApiEntry(subpath, name);
  }
}
