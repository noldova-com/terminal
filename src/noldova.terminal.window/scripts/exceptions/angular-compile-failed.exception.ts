/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PackageException } from "../../../../scripts/exceptions/package.exception.ts";
import { Resources } from "../resources.ts";

export class AngularCompileFailedException extends PackageException {
  public readonly sources: string;
  public readonly exitCode: number | null;
  public readonly output: string;

  public constructor(sources: string, exitCode: number | null, output: string) {
    super(Resources.formatAngularCompileFailed(sources, exitCode, output));

    this.sources = sources;
    this.exitCode = exitCode;
    this.output = output;
  }
}
