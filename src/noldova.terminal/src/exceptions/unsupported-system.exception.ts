/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SystemRequirement } from "../enums/system-requirement.ts";
import { Resources } from "../resources.ts";
import { TerminalException } from "./terminal.exception.ts";

export class UnsupportedSystemException extends TerminalException {
  public readonly requirement: SystemRequirement;
  public readonly found: string;

  public constructor(requirement: SystemRequirement, found: string) {
    super(Resources.formatUnsupportedSystem(requirement, found));

    this.requirement = requirement;
    this.found = found;
  }
}
