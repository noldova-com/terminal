/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalInputMark } from "@noldova/terminal.protocol";

import type { IOutputBatcherListener } from "../interfaces/i-output-batcher-listener.ts";
import { Resources } from "../resources.ts";

export class OutputBatcher {
  private readonly listener: IOutputBatcherListener;
  private parts: string[] = [];
  private length: number = 0;
  private offset: number = 0;
  private timer: NodeJS.Timeout | null = null;
  private inputs: TerminalInputMark[] = [];

  public constructor(listener: IOutputBatcherListener) {
    this.listener = listener;
  }

  public append(data: string, inputs: readonly TerminalInputMark[] = []): void {
    const start: number = this.offset + this.length;
    for (const input of inputs)
      this.inputs.push(new TerminalInputMark(start + input.offset, input.edge));
    if (data.length === 0)
      return;
    this.parts.push(data);
    this.length += data.length;
    if (this.length >= Resources.batchLength)
      this.flush();
    else
      this.timer ??= setTimeout(() => this.flush(), Resources.batchMilliseconds);
  }

  public flush(): void {
    this.cancelTimer();
    const data: string = this.parts.join("");
    this.parts = [];
    this.length = 0;
    let start: number = 0;
    while (start < data.length) {
      const end: number = OutputBatcher.toBatchEnd(data, start);
      const offset: number = this.offset;
      this.offset += end - start;
      const after: number = this.inputs.findIndex(t => t.offset > this.offset);
      this.listener.onBatch(offset, data.slice(start, end), this.inputs.splice(0, after < 0 ? this.inputs.length : after));
      start = end;
    }
  }

  public dispose(): void {
    this.cancelTimer();
  }

  private cancelTimer(): void {
    if (this.timer === null)
      return;
    clearTimeout(this.timer);
    this.timer = null;
  }

  private static toBatchEnd(data: string, start: number): number {
    const end: number = Math.min(start + Resources.batchLength, data.length);
    const last: number = data.charCodeAt(end - 1);
    return end < data.length && last >= Resources.outputBatcherFirstHighSurrogate && last <= Resources.outputBatcherLastHighSurrogate ? end - 1 : end;
  }
}
