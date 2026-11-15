/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class ArchiveUnreadableException extends PackageException {
  public readonly archive: string;

  public constructor(archive: string, cause: unknown) {
    super(Resources.formatArchiveUnreadable(archive), { cause });

    this.archive = archive;
  }
}
