/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ScriptException } from "./script.exception.ts";

export abstract class ProcessException extends ScriptException {
  protected constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}
