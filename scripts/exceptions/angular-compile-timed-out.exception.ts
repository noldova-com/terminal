/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class AngularCompileTimedOutException extends PackageException {
  public readonly sources: string;
  public readonly timeout: number;

  public constructor(sources: string, timeout: number, cause: unknown) {
    super(Resources.formatAngularCompileTimedOut(sources, timeout), { cause });

    this.sources = sources;
    this.timeout = timeout;
  }
}
