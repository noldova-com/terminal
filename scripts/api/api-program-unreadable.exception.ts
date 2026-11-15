/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApiResources } from "./api.resources.ts";
import { ApiException } from "./api.exception.ts";

export class ApiProgramUnreadableException extends ApiException {
  public readonly projectFile: string;
  public readonly problems: readonly string[];

  public constructor(projectFile: string, problems: readonly string[]) {
    super(ApiResources.formatProgramUnreadable(projectFile, problems));

    this.projectFile = projectFile;
    this.problems = problems;
  }
}
