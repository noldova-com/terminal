/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { TerminalTextStyle } from "@noldova/terminal.protocol";

export class StyleParameter {
  public readonly style: TerminalTextStyle;
  public readonly parameter: number;

  public constructor(style: TerminalTextStyle, parameter: number) {
    this.style = style;
    this.parameter = parameter;
  }
}
