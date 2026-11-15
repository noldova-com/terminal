/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SystemRequirement } from "../enums/system-requirement.ts";

export class SystemShortfall {
  public readonly requirement: SystemRequirement;
  public readonly found: string;

  public constructor(requirement: SystemRequirement, found: string) {
    this.requirement = requirement;
    this.found = found;
  }
}
