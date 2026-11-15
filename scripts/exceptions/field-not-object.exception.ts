/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class FieldNotObjectException extends PackageException {
  public readonly file: string;
  public readonly field: string;

  public constructor(file: string, field: string) {
    super(Resources.formatFieldNotObject(file, field));

    this.file = file;
    this.field = field;
  }
}
