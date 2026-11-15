/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { ArgumentValidator } from "../services/argument.validator.ts";
import type { ProtocolReader } from "../services/protocol.reader.ts";

export class TerminalTextRun {
  public readonly length: number;
  public readonly foreground: number;
  public readonly background: number;
  public readonly style: number;

  public constructor(length: number, foreground: number, background: number, style: number) {
    ArgumentValidator.requireIntegerInRange(Resources.lengthField, length, 1, Resources.maximumLineLength);
    TerminalTextRun.requireColor(Resources.foregroundField, foreground);
    TerminalTextRun.requireColor(Resources.backgroundField, background);
    ArgumentValidator.requireIntegerInRange(Resources.styleField, style, 0, Resources.maximumTextStyle);

    this.length = length;
    this.foreground = foreground;
    this.background = background;
    this.style = style;
  }

  public static fromReader(reader: ProtocolReader): TerminalTextRun {
    reader.allowOnly([
      Resources.lengthField,
      Resources.foregroundField,
      Resources.backgroundField,
      Resources.styleField
    ]);
    return reader.create(() => new TerminalTextRun(
      reader.readInteger(Resources.lengthField, 1, Resources.maximumLineLength),
      reader.readInteger(Resources.foregroundField, Resources.defaultColor, Resources.maximumColor),
      reader.readInteger(Resources.backgroundField, Resources.defaultColor, Resources.maximumColor),
      reader.readInteger(Resources.styleField, 0, Resources.maximumTextStyle)));
  }

  public toJson(): JsonObject {
    return { length: this.length, foreground: this.foreground, background: this.background, style: this.style };
  }

  private static requireColor(name: string, value: number): void {
    const isPalette: boolean = value >= 0 && value < Resources.paletteSize;
    const isRgb: boolean = value >= Resources.rgbColor && value <= Resources.maximumColor;
    if (!Number.isSafeInteger(value) || (value !== Resources.defaultColor && !isPalette && !isRgb))
      throw new ArgumentException(Resources.formatNotColor(Resources.valueSubject), name);
  }
}
