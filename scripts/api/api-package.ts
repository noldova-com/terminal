/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import type { IModulePackage } from "../interfaces/i-module-package.ts";
import { Resources } from "../resources.ts";
import { ApiEntry } from "./api-entry.ts";
import { ApiVisibility } from "./api-visibility.ts";
import { ApiResources } from "./api.resources.ts";

export class ApiPackage {
  public readonly directory: string;
  public readonly title: string;
  public readonly id: string;
  public readonly specifier: string;
  public readonly project: string;
  public readonly implementation: string;
  public readonly declarations: string;
  public readonly visibility: ApiVisibility;

  private constructor(directory: string, entry: ApiEntry, id: string, specifier: string, project: string, implementation: string, declarations: string,
    visibility: ApiVisibility) {
    this.directory = directory;
    this.title = entry.isMain ? directory : ApiResources.formatEntryTitle(directory, entry.subpath);
    this.id = entry.isMain ? id : ApiResources.formatEntryId(id, entry.name);
    this.specifier = specifier;
    this.project = project;
    this.implementation = implementation;
    this.declarations = declarations;
    this.visibility = visibility;
  }

  public static forPackage(root: string, modulePackage: IModulePackage, entry: ApiEntry = ApiEntry.MAIN): ApiPackage {
    const directory = modulePackage.folder;
    const api = path.join(root, ...directory.split(Resources.posixSeparator), Resources.sourceFolder, Resources.apiFolder);
    const projectFolder = ApiResources.entryProjects.get(ApiResources.formatEntryProject(directory, entry.name)) ?? directory;
    return new ApiPackage(directory, entry, path.posix.basename(directory), path.posix.join(modulePackage.name, entry.subpath),
      path.join(root, ...projectFolder.split(Resources.posixSeparator), Resources.projectFile), path.join(api, `${entry.name}${Resources.sourceExtension}`),
      path.join(api, `${entry.name}${Resources.declarationExtension}`), ApiVisibility.PUBLIC_AND_PROTECTED);
  }
}
