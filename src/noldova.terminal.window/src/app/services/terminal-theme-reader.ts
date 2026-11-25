/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.ts";
import { CommandTokenKind } from "../enums/command-token-kind.ts";
import { CommandColors } from "../models/command-colors.ts";
import { TerminalAppearance } from "../models/terminal-appearance.ts";
import type { AnsiKey } from "../types/ansi-key.ts";

export class TerminalThemeReader {
  public static read(element: HTMLElement, fontSize: number): TerminalAppearance {
    const style: CSSStyleDeclaration = getComputedStyle(element);
    const isDark: boolean = style.colorScheme === Resources.darkScheme;
    const forced: boolean = matchMedia(Resources.forcedColorsQuery).matches;
    const system = (value: string): string => forced ? TerminalThemeReader.compute(element, value) : value;
    const colors: Partial<Record<AnsiKey, string>> = {};
    for (const [key, name] of Resources.ansiColors) {
      const value: string = TerminalThemeReader.readToken(style, Resources.colorTokenPrefix + name, "");
      if (value.length > 0)
        colors[key] = system(value);
    }
    const background: string = TerminalThemeReader.readBackground(element);
    const foreground: string = style.color;
    const selectedText: string = TerminalThemeReader.readToken(style, Resources.selectionForegroundToken, "");
    const selected: string = TerminalThemeReader.readToken(style, Resources.selectionToken, TerminalThemeReader.readToken(style, Resources.selectedToken,
      TerminalThemeReader.readToken(style, Resources.colorTokenPrefix + Resources.brightBlackColor, "")));
    const selection: string | null = selected.length > 0 ? system(selected) : null;
    return new TerminalAppearance(
      {
        background,
        foreground,
        cursor: system(TerminalThemeReader.readToken(style, Resources.cursorToken, TerminalThemeReader.readToken(style, Resources.accentToken, foreground))),
        cursorAccent: forced ? background : isDark ? Resources.darkCursorAccent : Resources.lightCursorAccent,
        overviewRulerBorder: Resources.hiddenColor,
        scrollbarSliderBackground: Resources.hiddenColor,
        scrollbarSliderHoverBackground: Resources.hiddenColor,
        scrollbarSliderActiveBackground: Resources.hiddenColor,
        ...(Object.isNull(selection) ? {} : { selectionBackground: selection }),
        ...(forced && !Object.isNull(selection) ? { selectionInactiveBackground: TerminalThemeReader.fade(selection,
          matchMedia(Resources.darkPaletteQuery).matches ? Resources.darkInactiveSelectionOpacity : Resources.lightInactiveSelectionOpacity) } : {}),
        ...(selectedText.length > 0 ? { selectionForeground: system(selectedText) } : {}),
        ...colors
      },
      TerminalThemeReader.readToken(style, Resources.fontFamilyToken, Resources.fontFamily),
      fontSize,
      TerminalThemeReader.readScrollbarSize(element));
  }

  public static readCommandColors(element: HTMLElement): CommandColors {
    if (matchMedia(Resources.forcedColorsQuery).matches)
      return new CommandColors();
    const style: CSSStyleDeclaration = getComputedStyle(element);
    const colors: Partial<Record<CommandTokenKind, string>> = {};
    for (const kind of Object.values(CommandTokenKind)) {
      const value: string = style.getPropertyValue(Resources.commandColorTokens[kind]).trim();
      if (Resources.hexColorPattern.test(value))
        colors[kind] = value;
    }
    return new CommandColors(colors);
  }

  public static readBackground(element: HTMLElement): string {
    const style: CSSStyleDeclaration = getComputedStyle(element);
    for (let current: HTMLElement | null = element; !Object.isNull(current); current = current.parentElement) {
      const background: string = getComputedStyle(current).backgroundColor;
      if (!Resources.unpaintedPattern.test(background))
        return background;
    }
    return TerminalThemeReader.readToken(style, Resources.backgroundToken, style.backgroundColor);
  }

  private static compute(element: HTMLElement, value: string): string {
    const probe: HTMLElement = document.createElement(Resources.spanTag);
    probe.style.forcedColorAdjust = Resources.unforcedColorAdjust;
    probe.style.color = value;
    element.append(probe);
    const computed: string = getComputedStyle(probe).color;
    probe.remove();
    return computed;
  }

  private static readScrollbarSize(element: HTMLElement): number {
    const probe: HTMLElement = document.createElement(Resources.spanTag);
    probe.style.position = Resources.probePosition;
    probe.style.visibility = Resources.probeVisibility;
    probe.style.inlineSize = Resources.formatSizeVariable(Resources.scrollbarSizeToken);
    element.append(probe);
    const size: number = parseFloat(getComputedStyle(probe).inlineSize);
    probe.remove();
    return size;
  }

  private static fade(computed: string, share: number): string {
    const match: RegExpExecArray | null = Resources.computedColorPattern.exec(computed);
    return Object.isNull(match) ? computed : Resources.formatRgba(match[1], match[2], match[3], Number(match[4] ?? Resources.opaqueAlpha) * share);
  }

  private static readToken(style: CSSStyleDeclaration, name: string, fallback: string): string {
    const value: string = style.getPropertyValue(name).trim();
    return value.length > 0 ? value : fallback;
  }
}
