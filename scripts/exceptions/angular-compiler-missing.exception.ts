/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class AngularCompilerMissingException extends PackageException {
  public readonly project: string;

  public constructor(project: string) {
    super(Resources.formatAngularCompilerMissing(project));

    this.project = project;
  }
}
