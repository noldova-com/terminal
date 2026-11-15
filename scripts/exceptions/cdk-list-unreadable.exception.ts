/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ProcessException } from "./process.exception.ts";

export class CdkListUnreadableException extends ProcessException {
  public readonly folder: string;
  public readonly output: string;

  public constructor(folder: string, output: string, cause: unknown) {
    super(Resources.formatCdkListUnreadable(folder, output), { cause });

    this.folder = folder;
    this.output = output;
  }
}
