/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { TerminalException } from "./terminal.exception.ts";

export class AgentTerminalRestartException extends TerminalException {
  public readonly sessionId: string;

  public constructor(sessionId: string) {
    super(Resources.formatAgentTerminalRestart(sessionId));

    this.sessionId = sessionId;
  }
}
