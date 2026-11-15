/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PackageCopy {
  public readonly source: string;
  public readonly packageName: string;
  public readonly entry: string;

  public constructor(source: string, packageName: string, entry: string) {
    this.source = source;
    this.packageName = packageName;
    this.entry = entry;
  }
}
