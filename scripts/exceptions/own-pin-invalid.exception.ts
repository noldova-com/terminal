/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class OwnPinInvalidException extends PackageException {
  public readonly file: string;
  public readonly packageName: string;
  public readonly pin: string;

  public constructor(file: string, packageName: string, pin: string) {
    super(Resources.formatOwnPinInvalid(file, packageName, pin));

    this.file = file;
    this.packageName = packageName;
    this.pin = pin;
  }
}
