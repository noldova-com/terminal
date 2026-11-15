/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { basename, dirname, win32 } from "node:path";

import type { IFileSystemReader } from "../../src/interfaces/i-file-system-reader.ts";
import { FolderEntry } from "../../src/models/folder-entry.ts";

export class FakeFileSystemReader implements IFileSystemReader {
  public readonly files: Map<string, string> = new Map<string, string>();
  public readonly bytes: Map<string, Uint8Array> = new Map<string, Uint8Array>();
  public readonly folders: Set<string> = new Set<string>();
  public readonly aliases: Set<string> = new Set<string>();
  public readonly realPaths: Map<string, string> = new Map<string, string>();
  public hold: Promise<void> | null = null;
  public readonly held: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  public readonly stalled: Map<string, Promise<void>> = new Map<string, Promise<void>>();
  public readonly listed: string[] = [];

  public async isFileAsync(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  public async isProgramAsync(path: string): Promise<boolean> {
    return this.files.has(path) || this.aliases.has(path);
  }

  public async isFolderAsync(path: string): Promise<boolean> {
    if (this.hold !== null) {
      this.held.resolve();
      await this.hold;
    }
    return this.folders.has(path);
  }

  public async readTextOrNullAsync(path: string): Promise<string | null> {
    this.listed.push(path);
    const stall: Promise<void> | undefined = this.stalled.get(path);
    if (stall !== undefined)
      await stall;
    return this.files.get(path) ?? null;
  }

  public async readBytesOrNullAsync(path: string): Promise<Uint8Array | null> {
    return this.bytes.get(path) ?? null;
  }

  public async readFolderNamesAsync(path: string): Promise<readonly string[]> {
    return [...this.folders].filter(t => dirname(t) === path).map(t => basename(t));
  }

  public async readEntriesAsync(path: string): Promise<readonly FolderEntry[]> {
    this.listed.push(path);
    const stall: Promise<void> | undefined = this.stalled.get(path);
    if (stall !== undefined)
      await stall;
    return [
      ...[...this.folders].filter(t => this.parentOf(t) === path).map(t => new FolderEntry(this.nameOf(t), true)),
      ...[...this.files.keys(), ...this.aliases].filter(t => this.parentOf(t) === path).map(t => new FolderEntry(this.nameOf(t), false))
    ];
  }

  public async readRealPathOrNullAsync(path: string): Promise<string | null> {
    return this.realPaths.get(path) ?? null;
  }

  private parentOf(path: string): string {
    return /^[A-Za-z]:\\/u.test(path) ? win32.dirname(path) : dirname(path);
  }

  private nameOf(path: string): string {
    return /^[A-Za-z]:\\/u.test(path) ? win32.basename(path) : basename(path);
  }
}
