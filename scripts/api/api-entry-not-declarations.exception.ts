/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApiResources } from "./api.resources.ts";
import { ApiException } from "./api.exception.ts";

export class ApiEntryNotDeclarationsException extends ApiException {
  public readonly file: string;
  public readonly subpath: string;
  public readonly target: string;

  public constructor(file: string, subpath: string, target: string) {
    super(ApiResources.formatEntryNotDeclarations(file, subpath, target));

    this.file = file;
    this.subpath = subpath;
    this.target = target;
  }
}
