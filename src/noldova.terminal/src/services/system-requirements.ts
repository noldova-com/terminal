/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SystemRequirement } from "../enums/system-requirement.ts";
import { SystemShortfall } from "../models/system-shortfall.ts";
import { Resources } from "../resources.ts";

export class SystemRequirements {
  public static findShortfall(platform: string, osRelease: string, report: unknown): SystemShortfall | null {
    if (platform === Resources.windowsPlatform) {
      const build: number | null = SystemRequirements.readWindowsBuild(osRelease);
      if (build === null)
        return new SystemShortfall(SystemRequirement.WindowsBuild, osRelease);
      return build < Resources.minimumWindowsBuild ? new SystemShortfall(SystemRequirement.WindowsBuild, String(build)) : null;
    }
    if (platform === Resources.linuxPlatform) {
      const version: string | null = SystemRequirements.readGlibcVersion(report);
      return version !== null && SystemRequirements.isBelowGlibcMinimum(version) ? new SystemShortfall(SystemRequirement.Glibc, version) : null;
    }
    return null;
  }

  public static readWindowsBuild(osRelease: string): number | null {
    const match: RegExpExecArray | null = Resources.systemRequirementsWindowsBuild.exec(osRelease);
    return match === null ? null : Number(match[1]);
  }

  private static readGlibcVersion(report: unknown): string | null {
    if (typeof report !== "object" || report === null || !(Resources.reportHeaderField in report))
      return null;
    const header: unknown = report[Resources.reportHeaderField];
    if (typeof header !== "object" || header === null || !(Resources.reportGlibcVersionField in header))
      return null;
    const version: unknown = header[Resources.reportGlibcVersionField];
    return typeof version === "string" ? version : null;
  }

  private static isBelowGlibcMinimum(version: string): boolean {
    const match: RegExpExecArray | null = Resources.systemRequirementsGlibcVersion.exec(version);
    if (match === null)
      return false;
    const [minimumMajor, minimumMinor] = Resources.minimumGlibcVersion;
    const major: number = Number(match[1]);
    return major < minimumMajor || (major === minimumMajor && Number(match[2]) < minimumMinor);
  }
}
