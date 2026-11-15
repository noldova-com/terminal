/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IFileSystemWriter } from "../../src/interfaces/i-file-system-writer.ts";

export class FakeFileSystemWriter implements IFileSystemWriter {
  public readonly files: Map<string, string> = new Map<string, string>();
  public readonly removed: string[] = [];
  public readonly removedFiles: string[] = [];
  public readonly missingFolders: [string, number][] = [];
  public folders: number = 0;
  public failure: Error | string | null = null;
  public removalFailure: Error | string | null = null;
  public fileRemovalFailure: Error | string | null = null;
  public writeFailure: Error | string | null = null;
  public missingFolderFailure: Error | string | null = null;
  public writeFailurePath: string = "";

  public nonceFor(environment: Readonly<Record<string, string>> | undefined): string {
    const file: string = (environment?.["NOLDOVA_TERMINAL_NONCE_FILE"] ?? "").replaceAll("\\", "/");
    return [...this.files].find(([t]) => t.replaceAll("\\", "/") === file)?.[1].trim() ?? "";
  }

  public createPrivateFolderAsync(prefix: string): Promise<string> {
    if (this.failure !== null)
      return Promise.reject(this.failure);
    this.folders++;
    return Promise.resolve(`${prefix}${this.folders}`);
  }

  public createMissingFolderAsync(path: string, mode: number): Promise<void> {
    this.missingFolders.push([path, mode]);
    return this.missingFolderFailure === null ? Promise.resolve() : Promise.reject(this.missingFolderFailure);
  }

  public async writeTextAsync(path: string, text: string): Promise<void> {
    if (this.writeFailure !== null && path.includes(this.writeFailurePath))
      throw this.writeFailure;
    this.files.set(path, text);
  }

  public appendTextAsync(path: string, text: string): Promise<void> {
    if (this.failure !== null)
      return Promise.reject(this.failure);
    this.files.set(path, (this.files.get(path) ?? "") + text);
    return Promise.resolve();
  }

  public removeFileAsync(path: string): Promise<void> {
    if (this.fileRemovalFailure !== null)
      return Promise.reject(this.fileRemovalFailure);
    this.removedFiles.push(path);
    return Promise.resolve();
  }

  public removeFolderAsync(path: string): Promise<void> {
    if (this.removalFailure !== null)
      return Promise.reject(this.removalFailure);
    this.removed.push(path);
    return Promise.resolve();
  }
}
