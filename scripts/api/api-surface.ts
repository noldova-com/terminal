/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApiResources } from "./api.resources.ts";

export class ApiSurface {
  private readonly entries: ReadonlyMap<string, string>;

  public constructor(entries: ReadonlyMap<string, string>) {
    this.entries = new Map(entries);
  }

  public get size(): number {
    return this.entries.size;
  }

  public compare(declarations: ApiSurface): readonly string[] {
    const differences: string[] = [];
    for (const [path, implemented] of this.entries) {
      const declared = declarations.entries.get(path);
      if (declared === undefined)
        differences.push(ApiResources.formatSurfaceMissing(path, implemented));
      else if (declared !== implemented)
        differences.push(ApiResources.formatSurfaceDiffers(path, implemented, declared));
    }
    for (const [path, declared] of declarations.entries)
      if (!this.entries.has(path))
        differences.push(ApiResources.formatSurfaceUnimplemented(path, declared));
    return differences.sort();
  }
}
