/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";

import type { IFileSystemWriter } from "../interfaces/i-file-system-writer.ts";
import { Resources } from "../resources.ts";

export class FileSystemWriter implements IFileSystemWriter {
  public createPrivateFolderAsync(prefix: string): Promise<string> {
    return mkdtemp(prefix);
  }

  public async createMissingFolderAsync(path: string, mode: number): Promise<void> {
    try {
      await mkdir(path, { mode });
    }
    catch (error: unknown) {
      if (!(error instanceof Error && "code" in error && error.code === Resources.fileSystemWriterExistingPathCode))
        throw error;
    }
  }

  public writeTextAsync(path: string, text: string): Promise<void> {
    return writeFile(path, text, { encoding: Resources.utf8Encoding, mode: Resources.fileSystemWriterPrivateFileMode, flag: Resources.fileSystemWriterCreateOnlyFlag });
  }

  public appendTextAsync(path: string, text: string): Promise<void> {
    return appendFile(path, text, { encoding: Resources.utf8Encoding, mode: Resources.fileSystemWriterPrivateFileMode });
  }

  public removeFileAsync(path: string): Promise<void> {
    return rm(path, { force: true });
  }

  public removeFolderAsync(path: string): Promise<void> {
    return rm(path, { recursive: true, force: true });
  }
}
