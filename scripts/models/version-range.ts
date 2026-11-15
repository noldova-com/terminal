/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";

export class VersionRange {
  public readonly lowest: string;
  public readonly refused: string;

  private constructor(lowest: string, refused: string) {
    this.lowest = lowest;
    this.refused = refused;
  }

  public static parse(text: string): VersionRange | null {
    const match = Resources.rangePattern.exec(text);
    if (match === null)
      return null;
    const [, lowest = "", refused = ""] = match;
    return VersionRange.compare(lowest, refused) < 0 ? new VersionRange(lowest, refused) : null;
  }

  public static from(lowest: string): VersionRange {
    const [major = 0, minor = 0] = lowest.split(Resources.versionSeparator).map(Number);
    return new VersionRange(lowest, major === 0 ? Resources.formatFirstMinorRefused(minor + 1) : Resources.formatFirstMajorRefused(major + 1));
  }

  public static isRanged(name: string): boolean {
    return Resources.rangedPrefixes.some(t => name.startsWith(t)) || Resources.uiKitNames.includes(name);
  }

  public static isCore(name: string): boolean {
    return name.startsWith(Resources.desktopPrefix);
  }

  public static isAngular(name: string): boolean {
    return name.startsWith(Resources.angularPrefix);
  }

  private static compare(left: string, right: string): number {
    const [a, b] = [left, right].map(t => t.split(Resources.versionSeparator).map(Number));
    const index = [0, 1, 2].find(t => a?.[t] !== b?.[t]);
    return index === undefined ? 0 : (a?.[index] ?? 0) - (b?.[index] ?? 0);
  }

  public includes(version: string): boolean {
    return VersionRange.compare(this.lowest, version) <= 0 && VersionRange.compare(version, this.refused) < 0;
  }

  public toString(): string {
    return Resources.formatRange(this.lowest, this.refused);
  }
}
