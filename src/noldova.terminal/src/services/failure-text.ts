/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";

export class FailureText {
  public static read(error: unknown): string {
    if (!(error instanceof Error))
      return String(error);
    return error.cause === undefined ? error.message : Resources.formatFailureWithCause(error.message, FailureText.read(error.cause));
  }
}
