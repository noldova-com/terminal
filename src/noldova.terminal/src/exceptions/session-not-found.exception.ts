/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Failure, FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";

export class SessionNotFoundException extends MethodFailureException {
  public override readonly name: string = "SessionNotFoundException";
  public readonly sessionId: string;

  public constructor(sessionId: string) {
    super(new Failure(FailureCode.NotFound, Resources.formatSessionNotFound(sessionId)));

    this.sessionId = sessionId;
  }
}
