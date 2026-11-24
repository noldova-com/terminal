/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IMarker } from "@xterm/headless";

export class MirrorLine {
  private currentNumber: number;
  private readonly marker: IMarker | undefined;

  public constructor(number: number, marker: IMarker | undefined) {
    this.currentNumber = number;
    this.marker = marker;
  }

  public get number(): number {
    return this.currentNumber;
  }

  public get index(): number | null {
    return Object.isUndefined(this.marker) || this.marker.isDisposed ? null : this.marker.line;
  }

  public renumber(number: number): void {
    this.currentNumber = number;
  }

  public dispose(): void {
    this.marker?.dispose();
  }
}
