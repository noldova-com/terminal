/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class ArchiveEntryMalformedException extends PackageException {
  public readonly archive: string;
  public readonly offset: number;

  public constructor(archive: string, offset: number) {
    super(Resources.formatArchiveEntryMalformed(archive, offset));

    this.archive = archive;
    this.offset = offset;
  }
}
