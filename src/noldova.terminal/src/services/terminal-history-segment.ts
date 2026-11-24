/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { type FileHandle, open, rm } from "node:fs/promises";

import { JsonException } from "@noldova/context.json";
import { TerminalLine } from "@noldova/terminal.protocol";

import { StoredLinesDamagedException } from "../exceptions/stored-lines-damaged.exception.ts";
import { Resources } from "../resources.ts";

export class TerminalHistorySegment {
  private readonly blockOffsets: number[] = [];
  private handle: FileHandle | null = null;
  private batch: string[] = [];
  private lines: number = 0;
  private bytes: number = 0;
  private batchBytes: number = 0;
  private written: number = 0;

  public readonly path: string;
  public readonly first: number;

  public constructor(path: string, first: number) {
    this.path = path;
    this.first = first;
  }

  public get end(): number {
    return this.first + this.lines;
  }

  public get size(): number {
    return this.bytes;
  }

  public get hasBatch(): boolean {
    return this.batch.length > 0;
  }

  public append(text: string, bytes: number): void {
    if (this.lines % Resources.terminalHistoryBlockLines === 0)
      this.blockOffsets.push(this.bytes);
    this.lines += 1;
    this.bytes += bytes;
    this.batchBytes += bytes;
    this.batch.push(text);
  }

  public discard(): number {
    const bytes: number = this.batchBytes;
    this.batch = [];
    this.batchBytes = 0;
    return bytes;
  }

  public take(): Buffer {
    const buffer: Buffer = Buffer.from(this.batch.join(""), Resources.utf8Encoding);
    this.discard();
    return buffer;
  }

  public async writeAsync(buffer: Buffer): Promise<void> {
    await (await this.fileAsync()).write(buffer, 0, buffer.length, this.written);
    this.written += buffer.length;
  }

  public async readAsync(start: number, count: number): Promise<TerminalLine[]> {
    const lines: TerminalLine[] = [];
    const relative: number = start - this.first;
    const block: number = Math.floor(relative / Resources.terminalHistoryBlockLines);
    let skip: number = relative - block * Resources.terminalHistoryBlockLines;
    let position: number = this.blockOffsets[block] ?? this.written;
    let pending: Buffer = Buffer.alloc(0);
    const chunk: Buffer = Buffer.alloc(Resources.terminalHistoryReadBytes);
    while (lines.length < count) {
      const { bytesRead } = await (await this.fileAsync()).read(chunk, 0, chunk.length, position);
      if (bytesRead === 0)
        throw new StoredLinesDamagedException();
      position += bytesRead;
      let data: Buffer = Buffer.concat([pending, chunk.subarray(0, bytesRead)]);
      let newline: number = data.indexOf(Resources.lineFeedByte);
      while (newline >= 0 && lines.length < count) {
        if (skip > 0)
          skip -= 1;
        else
          lines.push(TerminalHistorySegment.parse(data.subarray(0, newline).toString(Resources.utf8Encoding)));
        data = data.subarray(newline + 1);
        newline = data.indexOf(Resources.lineFeedByte);
      }
      pending = data;
    }
    return lines;
  }

  public async closeAsync(): Promise<void> {
    if (!Object.isNull(this.handle))
      await this.handle.close();
    this.handle = null;
  }

  public async removeAsync(): Promise<void> {
    await this.closeAsync();
    await rm(this.path, { force: true });
  }

  private async fileAsync(): Promise<FileHandle> {
    this.handle ??= await open(this.path, Resources.terminalHistoryFlags, Resources.terminalHistoryMode);
    return this.handle;
  }

  private static parse(text: string): TerminalLine {
    try {
      return TerminalLine.fromJson(JSON.parse(text));
    }
    catch (error: unknown) {
      if (error instanceof SyntaxError || error instanceof JsonException)
        throw new StoredLinesDamagedException(error);
      throw error;
    }
  }
}
