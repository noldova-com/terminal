/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class CompileFailedException extends PackageException {
  public readonly project: string;
  public readonly exitCode: number;

  public constructor(project: string, exitCode: number) {
    super(Resources.formatCompileFailed(project, exitCode));

    this.project = project;
    this.exitCode = exitCode;
  }
}
