/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class PackFailedException extends PackageException {
  public readonly packageName: string;
  public readonly exitCode: number | null;
  public readonly output: string;

  public constructor(packageName: string, exitCode: number | null, output: string) {
    super(Resources.formatPackFailed(packageName, exitCode, output));

    this.packageName = packageName;
    this.exitCode = exitCode;
    this.output = output;
  }
}
