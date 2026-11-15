/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SavedTerminal {
  public readonly sessionId: string;
  public readonly shellId: string;
  public readonly folder: string;
  public readonly isPanelTerminal: boolean;
  public readonly owner: string | null;
  public readonly opensTab: boolean;
  public readonly name: string | null;

  public constructor(sessionId: string, shellId: string, folder: string, isPanelTerminal: boolean, owner: string | null = null,
    opensTab: boolean = true, name: string | null = null) {
    this.sessionId = sessionId;
    this.shellId = shellId;
    this.folder = folder;
    this.isPanelTerminal = isPanelTerminal;
    this.owner = owner;
    this.opensTab = opensTab;
    this.name = name;
  }
}
