/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import type { IModuleLog } from "@noldova/desktop.runtime";

import type { IFileSystemReader } from "../interfaces/i-file-system-reader.ts";
import type { IFileSystemWriter } from "../interfaces/i-file-system-writer.ts";
import type { IFolderAccess } from "../interfaces/i-folder-access.ts";
import type { IProcessSignaller } from "../interfaces/i-process-signaller.ts";
import { TerminalHistoryPaths } from "../models/terminal-history-paths.ts";
import { Resources } from "../resources.ts";
import { FailureText } from "./failure-text.ts";

export class TerminalHistoryFolder {
  private readonly writer: IFileSystemWriter;
  private readonly reader: IFileSystemReader;
  private readonly signaller: IProcessSignaller;
  private readonly temporaryFolder: string;
  private readonly pid: number;
  private readonly log: IModuleLog;
  private readonly access: IFolderAccess | null;
  private folder: Promise<string | null> | null = null;

  public constructor(writer: IFileSystemWriter, reader: IFileSystemReader, signaller: IProcessSignaller, temporaryFolder: string, pid: number,
    log: IModuleLog, access: IFolderAccess | null = null) {
    this.writer = writer;
    this.reader = reader;
    this.signaller = signaller;
    this.temporaryFolder = temporaryFolder;
    this.pid = pid;
    this.log = log;
    this.access = access;
  }

  public async pathsAsync(sessionId: string): Promise<TerminalHistoryPaths | null> {
    this.folder ??= this.createAsync();
    let folder: string | null;
    try {
      folder = await this.folder;
    }
    catch (error: unknown) {
      this.folder = null;
      throw error;
    }
    if (folder === null) {
      this.folder = null;
      return null;
    }
    return new TerminalHistoryPaths(
      path.join(folder, Resources.formatTerminalHistoryFile(sessionId, Resources.terminalHistoryFirstSegment)),
      path.join(folder, Resources.formatTerminalHistoryFile(sessionId, Resources.terminalHistorySecondSegment)));
  }

  public async removeAsync(): Promise<void> {
    const creating: Promise<string | null> | null = this.folder;
    this.folder = null;
    if (creating === null)
      return;
    let folder: string | null;
    try {
      folder = await creating;
    }
    catch (error: unknown) {
      this.log.write(Resources.formatTerminalHistoryCreateFailed(FailureText.read(error)));
      return;
    }
    if (folder !== null)
      await this.removeFolderAsync(folder);
  }

  private async createAsync(): Promise<string | null> {
    await this.removeLeftoversAsync();
    const folder: string = await this.writer.createPrivateFolderAsync(path.join(this.temporaryFolder, Resources.formatTerminalHistoryFolder(this.pid)));
    try {
      await this.access?.restrictAsync(folder);
    }
    catch (error: unknown) {
      this.log.write(Resources.formatTerminalHistoryNotPrivate(FailureText.read(error)));
      await this.removeFolderAsync(folder);
      return null;
    }
    return folder;
  }

  private async removeLeftoversAsync(): Promise<void> {
    for (const name of await this.reader.readFolderNamesAsync(this.temporaryFolder)) {
      const pid: number | null = TerminalHistoryFolder.toPid(name);
      if (pid !== null && pid !== this.pid && !this.signaller.isRunning(pid))
        await this.removeFolderAsync(path.join(this.temporaryFolder, name));
    }
  }

  private async removeFolderAsync(folder: string): Promise<void> {
    try {
      await this.writer.removeFolderAsync(folder);
    }
    catch (error: unknown) {
      this.log.write(Resources.formatTerminalHistoryRemovalFailed(folder, FailureText.read(error)));
    }
  }

  private static toPid(name: string): number | null {
    if (!name.startsWith(Resources.terminalHistoryFolderPrefix))
      return null;
    const match: RegExpExecArray | null = Resources.terminalHistoryFolderFolderSuffix.exec(name.slice(Resources.terminalHistoryFolderPrefix.length));
    const pid: number = Number(match?.[1]);
    return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
  }
}
