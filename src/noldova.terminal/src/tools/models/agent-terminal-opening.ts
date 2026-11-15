/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { isAbsolute } from "node:path";

import { ArgumentException } from "@noldova/context.exceptions";
import { ArgumentValidator, Resources as ProtocolResources } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";

export class AgentTerminalOpening {
  public readonly ownerSessionId: string;
  public readonly shellId: string | null;
  public readonly cwd: string;
  public readonly owner: string | null;

  public constructor(ownerSessionId: string, shellId: string | null, cwd: string, owner: string | null = null) {
    ArgumentValidator.requireIdentifier(Resources.agentTerminalOpeningOwnerSessionIdField, ownerSessionId);
    if (shellId !== null)
      ArgumentValidator.requireIdentifier(Resources.agentTerminalOpeningShellIdField, shellId);
    ArgumentValidator.requireNonBlank(Resources.cwdField, cwd, ProtocolResources.maximumPathLength);
    if (!isAbsolute(cwd))
      throw new ArgumentException(Resources.formatNotAbsolutePath(ProtocolResources.valueSubject), Resources.cwdField);

    this.ownerSessionId = ownerSessionId;
    this.shellId = shellId;
    this.cwd = cwd;
    this.owner = owner;
  }
}
