/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentValidator, RuntimeTerminalOwners, TerminalOwnerReference } from "@noldova/terminal.protocol";

import { Resources } from "../resources.ts";
import type { TerminalHost } from "./terminal-host.ts";

export class TerminalOwnerService extends RuntimeTerminalOwners {
  private readonly host: TerminalHost;

  public constructor(host: TerminalHost) {
    super();
    this.host = host;
  }

  public override async closeAsync(owner: string): Promise<void> {
    await this.host.closeOwnerAsync(new TerminalOwnerReference(owner).owner, null);
  }

  public override bindAgentSession(agentSessionId: string, owner: string): void {
    ArgumentValidator.requireIdentifier(Resources.terminalOwnerServiceAgentSessionIdField, agentSessionId);
    this.host.bindAgentSession(agentSessionId, new TerminalOwnerReference(owner).owner);
  }

  public override unbindAgentSession(agentSessionId: string): void {
    ArgumentValidator.requireIdentifier(Resources.terminalOwnerServiceAgentSessionIdField, agentSessionId);
    this.host.unbindAgentSession(agentSessionId);
  }
}
