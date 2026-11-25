/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { type IModuleDatabase, type IModuleLog, Migration } from "@noldova/desktop.runtime";

import { SavedTerminal } from "../models/saved-terminal.ts";
import { Resources } from "../resources.ts";
import { FailureText } from "./failure-text.ts";

export class SavedTerminals {
  public static readonly migrations: readonly Migration[] = [
    new Migration(Resources.savedTerminalsCreateTerminalsMigration, [Resources.savedTerminalsCreateTerminalsStatement]),
    new Migration(Resources.savedTerminalsAddOwnerMigration, [Resources.savedTerminalsAddOwnerStatement]),
    new Migration(Resources.savedTerminalsAddOpensTabMigration, [Resources.savedTerminalsAddOpensTabStatement]),
    new Migration(Resources.savedTerminalsAddNameMigration, [Resources.savedTerminalsAddNameStatement])
  ];

  private readonly database: IModuleDatabase;
  private readonly log: IModuleLog;

  public constructor(database: IModuleDatabase, log: IModuleLog) {
    this.database = database;
    this.log = log;
  }

  public list(): readonly SavedTerminal[] {
    return this.database.readAll(Resources.savedTerminalsListQuery)
      .map(t => new SavedTerminal(String(t[Resources.savedTerminalsSessionIdColumn]), String(t[Resources.savedTerminalsShellIdColumn]),
        String(t[Resources.savedTerminalsFolderColumn]), Number(t[Resources.savedTerminalsIsPanelTerminalColumn]) === 1,
        Object.isNull(t[Resources.savedTerminalsOwnerColumn]) ? null : String(t[Resources.savedTerminalsOwnerColumn]),
        Number(t[Resources.savedTerminalsOpensTabColumn]) === 1,
        Object.isNull(t[Resources.savedTerminalsNameColumn]) ? null : String(t[Resources.savedTerminalsNameColumn])));
  }

  public save(terminal: SavedTerminal): void {
    this.write(t => Resources.formatSavedTerminalUnwritable(terminal.sessionId, t), () => this.database.run(Resources.savedTerminalsSaveStatement,
      terminal.sessionId, terminal.shellId, terminal.folder, terminal.isPanelTerminal ? 1 : 0, terminal.owner, terminal.opensTab ? 1 : 0));
  }

  public moveTo(sessionId: string, folder: string): void {
    this.write(t => Resources.formatSavedTerminalUnwritable(sessionId, t), () => this.database.run(Resources.savedTerminalsMoveStatement,
      folder, sessionId));
  }

  public rename(sessionId: string, name: string | null): void {
    this.write(t => Resources.formatSavedTerminalUnwritable(sessionId, t), () => this.database.run(Resources.savedTerminalsRenameStatement,
      name, sessionId));
  }

  public forget(sessionId: string): void {
    this.write(t => Resources.formatSavedTerminalUnwritable(sessionId, t), () => this.database.run(Resources.savedTerminalsForgetStatement, sessionId));
  }

  public forgetOwner(owner: string): void {
    this.write(t => Resources.formatOwnerTerminalsUnwritable(owner, t), () => this.database.run(Resources.savedTerminalsForgetOwnerStatement, owner));
  }

  private write(format: (message: string) => string, action: () => void): void {
    try {
      action();
    }
    catch (error: unknown) {
      this.log.write(format(FailureText.read(error)));
    }
  }
}
