/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";
import type { CommandTokenKind } from "../enums/command-token-kind.ts";

export class CommandColorSpan {
  public readonly row: number;
  public readonly x: number;
  public readonly kind: CommandTokenKind;
  private cells: number;
  private characters: string;

  public constructor(row: number, x: number, width: number, kind: CommandTokenKind, text: string) {
    this.row = row;
    this.x = x;
    this.kind = kind;
    this.cells = width;
    this.characters = text;
  }

  public get width(): number {
    return this.cells;
  }

  public get text(): string {
    return this.characters;
  }

  public continuesAt(row: number, x: number, kind: CommandTokenKind | undefined): boolean {
    return this.kind === kind && this.row === row && this.x + this.cells === x;
  }

  public extend(width: number, text: string): void {
    this.cells += width;
    this.characters += text;
  }

  public toString(): string {
    return [this.row, this.x, this.cells, this.kind, this.characters].join(Resources.commandSpanFieldSeparator);
  }
}
