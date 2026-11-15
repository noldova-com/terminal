/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class AngularCompilerCommandMissingException extends PackageException {
  public readonly manifest: string;
  public readonly command: string;

  public constructor(manifest: string, command: string) {
    super(Resources.formatAngularCompilerCommandMissing(manifest, command));

    this.manifest = manifest;
    this.command = command;
  }
}
