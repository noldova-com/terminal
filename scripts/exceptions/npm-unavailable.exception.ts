/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ProcessException } from "./process.exception.ts";

export class NpmUnavailableException extends ProcessException {
  public constructor() {
    super(Resources.npmUnavailable);
  }
}
