/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources as ProtocolResources, type TerminalLine, type TerminalTextRun } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";

export class TerminalLineEncoder {
  public static encode(lines: readonly TerminalLine[], endsBroken: boolean): string {
    let text: string = "";
    for (const [index, line] of lines.entries()) {
      let offset: number = 0;
      for (const run of line.runs) {
        text += TerminalLineEncoder.attributes(run) + line.text.slice(offset, offset + run.length);
        offset += run.length;
      }
      text += Resources.resetAttributes;
      const next: TerminalLine | undefined = lines[index + 1];
      if (next === undefined ? endsBroken : !next.isWrapped)
        text += Resources.lineBreak;
    }
    return text;
  }

  private static attributes(run: TerminalTextRun): string {
    const parameters: number[] = [Resources.sgrReset];
    for (const [style, parameter] of Resources.styleParameters)
      if ((run.style & style) !== 0)
        parameters.push(parameter);
    parameters.push(...TerminalLineEncoder.color(run.foreground, Resources.sgrForeground));
    parameters.push(...TerminalLineEncoder.color(run.background, Resources.sgrBackground));
    return Resources.formatSgr(parameters);
  }

  private static color(color: number, selector: number): number[] {
    if (color < 0)
      return [];
    if (color < ProtocolResources.paletteSize)
      return [selector, Resources.sgrPaletteColor, color];
    const rgb: number = color - ProtocolResources.rgbColor;
    const mask: number = Resources.channelMask;
    return [selector, Resources.sgrRgbColor, (rgb >> Resources.redShift) & mask, (rgb >> Resources.greenShift) & mask, rgb & mask];
  }
}
