/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources as ProtocolResources } from "@noldova/terminal.protocol";

export class CommandHistory {
  private readonly commands: Map<string, readonly string[]> = new Map<string, readonly string[]>();

  public add(shellId: string, command: string): void {
    this.commands.set(shellId, [command, ...this.list(shellId).filter(t => t !== command)].slice(0, ProtocolResources.maximumSuggestedCommands));
  }

  public clear(): void {
    this.commands.clear();
  }

  public list(shellId: string): readonly string[] {
    return this.commands.get(shellId) ?? [];
  }
}
