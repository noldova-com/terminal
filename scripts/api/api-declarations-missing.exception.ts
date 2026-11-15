/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApiResources } from "./api.resources.ts";
import { ApiException } from "./api.exception.ts";

export class ApiDeclarationsMissingException extends ApiException {
  public readonly declarations: string;

  public constructor(declarations: string) {
    super(ApiResources.formatNoDeclarations(declarations));

    this.declarations = declarations;
  }
}
