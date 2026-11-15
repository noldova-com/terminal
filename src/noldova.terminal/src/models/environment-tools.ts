/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ICommandRunner } from "../interfaces/i-command-runner.ts";
import type { IFileSystemReader } from "../interfaces/i-file-system-reader.ts";
import type { IFileSystemWriter } from "../interfaces/i-file-system-writer.ts";
import type { IFolderAccess } from "../interfaces/i-folder-access.ts";
import type { ILineProcessStarter } from "../interfaces/i-line-process-starter.ts";

export class EnvironmentTools {
  public readonly starter: ILineProcessStarter;
  public readonly runner: ICommandRunner;
  public readonly reader: IFileSystemReader;
  public readonly writer: IFileSystemWriter;
  public readonly access: IFolderAccess | null;
  public readonly temporaryFolder: string;

  public constructor(starter: ILineProcessStarter, runner: ICommandRunner, reader: IFileSystemReader, writer: IFileSystemWriter, access: IFolderAccess | null,
    temporaryFolder: string) {
    this.starter = starter;
    this.runner = runner;
    this.reader = reader;
    this.writer = writer;
    this.access = access;
    this.temporaryFolder = temporaryFolder;
  }
}
