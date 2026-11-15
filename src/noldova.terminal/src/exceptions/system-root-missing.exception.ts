/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { EnvironmentUnreadableException } from "./environment-unreadable.exception.ts";

export class SystemRootMissingException extends EnvironmentUnreadableException {
  public constructor() {
    super(Resources.systemRootMissing);
  }
}
