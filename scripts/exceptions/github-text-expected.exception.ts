/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { GitHubException } from "./github.exception.ts";

export class GitHubTextExpectedException extends GitHubException {
  public readonly context: string;
  public readonly key: string;

  public constructor(context: string, key: string) {
    super(Resources.formatGitHubTextExpected(context, key));

    this.context = context;
    this.key = key;
  }
}
