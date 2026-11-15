/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PackageException } from "../../../../scripts/exceptions/package.exception.ts";
import { Resources } from "../resources.ts";

export class AngularEntriesMissingException extends PackageException {
  public readonly entries: string;

  public constructor(entries: string) {
    super(Resources.formatAngularEntriesMissing(entries));

    this.entries = entries;
  }
}
