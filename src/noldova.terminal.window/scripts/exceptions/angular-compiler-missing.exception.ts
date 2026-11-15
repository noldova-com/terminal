/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PackageException } from "../../../../scripts/exceptions/package.exception.ts";
import { Resources } from "../resources.ts";

export class AngularCompilerMissingException extends PackageException {
  public readonly project: string;

  public constructor(project: string) {
    super(Resources.formatAngularCompilerMissing(project));

    this.project = project;
  }
}
