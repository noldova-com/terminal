/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Registration } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";
import { OutputChunk } from "../tools/models/output-chunk.ts";
import { EscapeStripper } from "./escape-stripper.ts";

export class OutputLog {
  private readonly stripper: EscapeStripper = new EscapeStripper();
  private readonly limit: number;
  private readonly listeners: Set<(text: string) => void> = new Set<(text: string) => void>();
  private text: string = "";
  private startOffset: number = 0;

  public constructor(limit: number = Resources.maximumAgentTextLength) {
    this.limit = limit;
  }

  public get endOffset(): number {
    return this.startOffset + this.text.length;
  }

  public get isAwaitingSecret(): boolean {
    return Resources.secretPromptPattern.test(this.text.slice(this.text.lastIndexOf(Resources.lineFeed) + 1));
  }

  public append(data: string): void {
    const text: string = this.stripper.strip(data);
    if (text.length === 0)
      return;
    this.text += text;
    if (this.text.length > Resources.outputLogTrimFactor * this.limit) {
      const excess: number = this.text.length - this.limit;
      this.text = this.text.slice(excess);
      this.startOffset += excess;
    }
    for (const listener of this.listeners)
      listener(text);
  }

  public readRange(start: number, end: number): string {
    return this.text.slice(Math.max(start - this.startOffset, 0), Math.max(end - this.startOffset, 0));
  }

  public readSince(offset: number): OutputChunk {
    return this.readChunk(offset, this.endOffset);
  }

  public readChunk(start: number, end: number): OutputChunk {
    return new OutputChunk(this.readRange(start, end), end, Math.max(Math.min(this.startOffset, end) - start, 0));
  }

  public subscribe(listener: (text: string) => void): Registration {
    this.listeners.add(listener);
    return new Registration(() => this.listeners.delete(listener));
  }
}
