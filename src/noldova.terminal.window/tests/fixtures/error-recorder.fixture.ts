/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";

export class ErrorRecorder extends ErrorHandler {
  public readonly errors: unknown[] = [];

  public override handleError(error: unknown): void {
    this.errors.push(error);
  }
}
