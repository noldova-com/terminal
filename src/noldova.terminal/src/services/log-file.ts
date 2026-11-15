/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleLog } from "@noldova/desktop.runtime";

import type { IFileSystemWriter } from "../interfaces/i-file-system-writer.ts";
import { Resources } from "../resources.ts";
import { FailureText } from "./failure-text.ts";

export class LogFile {
  private readonly writer: IFileSystemWriter;
  private readonly log: IModuleLog;
  private pending: string = "";
  private length: number = 0;
  private writing: Promise<void> = Promise.resolve();
  private isWriting: boolean = false;
  private hasFailed: boolean = false;

  public readonly path: string;

  public constructor(writer: IFileSystemWriter, path: string, log: IModuleLog) {
    this.writer = writer;
    this.path = path;
    this.log = log;
  }

  public append(text: string): void {
    if (this.hasFailed || this.length >= Resources.maximumLogFileLength)
      return;
    const kept: string = text.slice(0, Resources.maximumLogFileLength - this.length);
    this.length += kept.length;
    this.pending += kept;
    if (this.length >= Resources.maximumLogFileLength) {
      this.pending += Resources.formatLogFileEnd(Resources.maximumLogFileLength);
      this.log.write(Resources.formatLogFileFull(this.path, Resources.maximumLogFileLength));
    }
    if (!this.isWriting) {
      this.isWriting = true;
      this.writing = this.writePendingAsync();
    }
  }

  public flushAsync(): Promise<void> {
    return this.writing;
  }

  private async writePendingAsync(): Promise<void> {
    while (this.pending.length > 0 && !this.hasFailed) {
      const text: string = this.pending;
      this.pending = "";
      try {
        await this.writer.appendTextAsync(this.path, text);
      }
      catch (error: unknown) {
        this.hasFailed = true;
        this.log.write(Resources.formatLogFailed(this.path, FailureText.read(error)));
      }
    }
    this.pending = "";
    this.isWriting = false;
  }
}
