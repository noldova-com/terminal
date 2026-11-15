/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IDecoration, IMarker } from "@xterm/xterm";

import type { CommandTokenKind } from "../enums/command-token-kind.ts";

export class CommandColorRun {
  public readonly marker: IMarker;
  public readonly x: number;
  public readonly width: number;
  public readonly kind: CommandTokenKind;
  public readonly text: string;
  public decoration: IDecoration | undefined = undefined;

  public constructor(marker: IMarker, x: number, width: number, kind: CommandTokenKind, text: string) {
    this.marker = marker;
    this.x = x;
    this.width = width;
    this.kind = kind;
    this.text = text;
  }
}
