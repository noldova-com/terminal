/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class Contrast {
  private static readonly opaque: RegExp = /^rgba?\((\d+), (\d+), (\d+)(?:, 1)?\)$/u;

  public static of(first: string, second: string): number {
    const [light, dark] = [Contrast.luminanceOf(first), Contrast.luminanceOf(second)].sort((a, b) => b - a);
    return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
  }

  private static luminanceOf(color: string): number {
    const match: RegExpExecArray | null = Contrast.opaque.exec(color);
    if (Object.isNull(match))
      throw new Error(`The contrast fixture reads only an opaque rgb() or rgba() color, not ${color}.`);
    const [r, g, b] = match.slice(1, 4).map(t => Number(t) / 255).map(t => (t <= 0.040_45 ? t / 12.92 : ((t + 0.055) / 1.055) ** 2.4));
    return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
  }
}
