/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ITheme } from "@xterm/xterm";

export class TerminalAppearance {
  public readonly theme: ITheme;
  public readonly fontFamily: string;
  public readonly fontSize: number;
  public readonly scrollbarSize: number;

  public constructor(theme: ITheme, fontFamily: string, fontSize: number, scrollbarSize: number) {
    this.theme = theme;
    this.fontFamily = fontFamily;
    this.fontSize = fontSize;
    this.scrollbarSize = scrollbarSize;
  }
}
