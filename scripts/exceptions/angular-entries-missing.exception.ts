/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class AngularEntriesMissingException extends PackageException {
  public readonly entries: string;

  public constructor(entries: string) {
    super(Resources.formatAngularEntriesMissing(entries));

    this.entries = entries;
  }
}
