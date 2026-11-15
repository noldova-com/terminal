/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class ArchiveFindingsException extends PackageException {
  public readonly findings: readonly string[];

  public constructor(findings: readonly string[]) {
    super(Resources.formatArchiveFindings(findings));

    this.findings = findings;
  }
}
