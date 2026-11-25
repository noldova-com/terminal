/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.ts";
import type { TrackedCommand } from "./tracked-command.ts";

export class TypedLine {
  private readonly echo: string;
  private tail: string = "";
  private isEchoed: boolean = false;

  public readonly startOffset: number;
  public command: TrackedCommand | null = null;
  public endOffset: number | null = null;

  public constructor(startOffset: number, text: string) {
    this.startOffset = startOffset;
    this.echo = TypedLine.compact(text.slice(Math.max(text.lastIndexOf(Resources.lineFeed), text.lastIndexOf(Resources.enterKey)) + 1));
  }

  public get isOpen(): boolean {
    return Object.isNull(this.command) && Object.isNull(this.endOffset);
  }

  public read(text: string): void {
    const lines: string[] = text.split(Resources.lineFeed);
    for (const [index, line] of lines.entries()) {
      if (this.isEchoed)
        return;
      const joined: string = this.tail + TypedLine.compact(line);
      this.tail = joined.slice(Math.max(0, joined.length - this.echo.length));
      this.isEchoed = index < lines.length - 1 && this.tail === this.echo;
    }
  }

  public prompt(offset: number): void {
    if (this.isEchoed)
      this.endOffset = offset;
  }

  private static compact(text: string): string {
    return text.replace(Resources.whiteSpace, "");
  }
}
