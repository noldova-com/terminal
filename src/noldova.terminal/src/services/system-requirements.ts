/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { SystemRequirement } from "../enums/system-requirement.ts";
import { SystemShortfall } from "../models/system-shortfall.ts";
import { Resources } from "../resources.ts";

export class SystemRequirements {
  public static findShortfall(platform: string, osRelease: string, report: unknown): SystemShortfall | null {
    if (platform === Resources.windowsPlatform) {
      const build: number | null = SystemRequirements.readWindowsBuild(osRelease);
      if (Object.isNull(build))
        return new SystemShortfall(SystemRequirement.WindowsBuild, osRelease);
      return build < Resources.minimumWindowsBuild ? new SystemShortfall(SystemRequirement.WindowsBuild, String(build)) : null;
    }
    if (platform === Resources.linuxPlatform) {
      const version: string | null = SystemRequirements.readGlibcVersion(report);
      return !Object.isNull(version) && SystemRequirements.isBelowGlibcMinimum(version) ? new SystemShortfall(SystemRequirement.Glibc, version) : null;
    }
    return null;
  }

  public static readWindowsBuild(osRelease: string): number | null {
    const match: RegExpExecArray | null = Resources.systemRequirementsWindowsBuild.exec(osRelease);
    return Object.isNull(match) ? null : Number(match[1]);
  }

  private static readGlibcVersion(report: unknown): string | null {
    if (!Object.isObject(report) || !(Resources.reportHeaderField in report))
      return null;
    const header: unknown = report[Resources.reportHeaderField];
    if (!Object.isObject(header) || !(Resources.reportGlibcVersionField in header))
      return null;
    const version: unknown = header[Resources.reportGlibcVersionField];
    return Object.isString(version) ? version : null;
  }

  private static isBelowGlibcMinimum(version: string): boolean {
    const match: RegExpExecArray | null = Resources.systemRequirementsGlibcVersion.exec(version);
    if (Object.isNull(match))
      return false;
    const [minimumMajor, minimumMinor] = Resources.minimumGlibcVersion;
    const major: number = Number(match[1]);
    return major < minimumMajor || (major === minimumMajor && Number(match[2]) < minimumMinor);
  }
}
