/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cdp } from "vitest/browser";

import { CommandColors } from "../../../src/app/models/command-colors.ts";
import type { TerminalAppearance } from "../../../src/app/models/terminal-appearance.ts";
import { TerminalThemeReader } from "../../../src/app/services/terminal-theme-reader.ts";
import { Contrast } from "../../fixtures/contrast.fixture.ts";

class ContrastCase {
  public readonly theme: string;
  public readonly canvas: string;
  public readonly highlight: string;
  public readonly isDark: boolean;

  public constructor(theme: string, canvas: string, highlight: string, isDark: boolean) {
    this.theme = theme;
    this.canvas = canvas;
    this.highlight = highlight;
    this.isDark = isDark;
  }
}

describe("TerminalThemeReader", () => {
  const elements: HTMLElement[] = [];

  function createElement(properties: Readonly<Record<string, string>>, parent: HTMLElement = document.body): HTMLElement {
    const element: HTMLElement = document.createElement("div");
    for (const [name, value] of Object.entries(properties))
      element.style.setProperty(name, value);
    parent.append(element);
    elements.push(element);
    return element;
  }

  async function forceColorsAsync(scheme: string = "light"): Promise<void> {
    await cdp().send("Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value: "active" }, { name: "prefers-color-scheme", value: scheme }] });
  }

  afterEach(async () => {
    await cdp().send("Emulation.setEmulatedMedia", { features: [] });
    for (const element of elements.splice(0))
      element.remove();
  });

  it("takes the pane's colors and the default font at the size given, and a white cursor accent, leaving the ANSI colors and selection to xterm without terminal tokens", () => {
    const appearance: TerminalAppearance = TerminalThemeReader.read(createElement({ "background-color": "#ffffff", "color": "#1f1f1f" }), 13);

    expect(appearance.theme).toMatchObject({
      background: "rgb(255, 255, 255)",
      foreground: "rgb(31, 31, 31)",
      cursor: "rgb(31, 31, 31)",
      cursorAccent: "#ffffff"
    });
    expect(["selectionBackground", "selectionInactiveBackground", "selectionForeground", "black", "red", "brightWhite"]
      .filter(t => Object.hasOwn(appearance.theme, t))).toEqual([]);
    expect([appearance.fontFamily, appearance.fontSize]).toEqual(["\"Noldova Mono\", ui-monospace, \"Cascadia Mono\", Consolas, monospace", 13]);
  });

  it("takes a black cursor accent in dark mode, and the theme's own tokens and code font, but not the kit's terminal text size", () => {
    const appearance: TerminalAppearance = TerminalThemeReader.read(createElement({
      "color-scheme": "dark",
      "background-color": "#1f1f1f",
      "color": "#cccccc",
      "--nol-accent": "#0078d4",
      "--nol-selected": "#264f78",
      "--nol-terminal-ansi-red": " #ff0000 ",
      "--nol-font-mono": "\"Cascadia Mono\", monospace",
      "--nol-text-terminal": "21px"
    }), 15);

    expect(appearance.theme).toMatchObject({
      cursor: "#0078d4",
      cursorAccent: "#000000",
      selectionBackground: "#264f78",
      red: "#ff0000"
    });
    expect(Object.hasOwn(appearance.theme, "green")).toBe(false);
    expect([appearance.fontFamily, appearance.fontSize]).toEqual(["\"Cascadia Mono\", monospace", 15]);
  });

  it("takes the kit's terminal cursor, selection and selection text tokens over the accent and selected tokens", () => {
    const appearance: TerminalAppearance = TerminalThemeReader.read(createElement({
      "--nol-accent": "#0078d4",
      "--nol-selected": "#264f78",
      "--nol-terminal-cursor": " #cccccc ",
      "--nol-terminal-selection": "#add6ff",
      "--nol-terminal-selection-foreground": "#3b3b3b"
    }), 13);

    expect(appearance.theme).toMatchObject({ cursor: "#cccccc", selectionBackground: "#add6ff", selectionForeground: "#3b3b3b" });
    expect(Object.hasOwn(appearance.theme, "selectionInactiveBackground")).toBe(false);
  });

  it("draws on the nearest background painted behind the pane, past those that paint nothing in either color form", () => {
    const host: HTMLElement = createElement({ "background-color": "#102030" });
    const clear: HTMLElement = createElement({ "background-color": "rgba(1, 2, 3, 0)" }, createElement({ "background-color": "color(srgb 1 0 0 / 0)" }, host));

    expect(TerminalThemeReader.read(createElement({}, clear), 13).theme).toMatchObject({ background: "rgb(16, 32, 48)" });
    expect(TerminalThemeReader.readBackground(createElement({}, createElement({ "background-color": "rgb(0, 0, 0)" }, host)))).toBe("rgb(0, 0, 0)");
    expect(TerminalThemeReader.readBackground(createElement({}, createElement({ "background-color": "rgba(0, 0, 0, 0.5)" }, host)))).toBe("rgba(0, 0, 0, 0.5)");
  });

  it("gives xterm the kit's scrollbar size in pixels, 0 without the kit, and an overview ruler border and slider that paint nothing, since the pane draws the kit's scrollbar", () => {
    const rem: number = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const kit: TerminalAppearance = TerminalThemeReader.read(createElement({ "--nol-scrollbar-size": "0.375rem" }), 13);
    const plain: TerminalAppearance = TerminalThemeReader.read(createElement({}), 13);

    expect([kit.scrollbarSize, plain.scrollbarSize, kit.theme.overviewRulerBorder, kit.theme.scrollbarSliderBackground, kit.theme.scrollbarSliderHoverBackground,
      kit.theme.scrollbarSliderActiveBackground]).toEqual([0.375 * rem, 0, "#00000000", "#00000000", "#00000000", "#00000000"]);
    expect(elements.map(t => t.childElementCount)).toEqual([0, 0]);
  });

  it("gives xterm the kit's scrollbar size for a pane read inside a hidden subtree, which lays nothing out", () => {
    const rem: number = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const hidden: HTMLElement = createElement({ display: "none", "--nol-scrollbar-size": "0.375rem" });

    const appearance: TerminalAppearance = TerminalThemeReader.read(createElement({}, hidden), 13);

    expect([appearance.scrollbarSize, hidden.getBoundingClientRect().width]).toEqual([0.375 * rem, 0]);
  });

  it("draws on the kit's terminal background when nothing behind the pane paints, and on nothing without the kit", () => {
    expect(TerminalThemeReader.readBackground(createElement({ "--nol-terminal-background": " #1f1f1f " }))).toBe("#1f1f1f");
    expect(TerminalThemeReader.readBackground(createElement({}))).toBe("rgba(0, 0, 0, 0)");
  });

  it("gives selected text the kit's terminal selection text color and the cursor accent Canvas in forced colors, and xterm every color there as the pane computes it", async () => {
    await forceColorsAsync();
    const computed = (color: string): string => getComputedStyle(createElement({ color, "forced-color-adjust": "none" })).color;

    const appearance: TerminalAppearance = TerminalThemeReader.read(createElement({
      "background-color": "Canvas",
      "--nol-terminal-cursor": "CanvasText",
      "--nol-terminal-selection": "Highlight",
      "--nol-terminal-selection-foreground": " HighlightText ",
      "--nol-terminal-ansi-red": "CanvasText"
    }), 13);

    expect(appearance.theme).toMatchObject({
      cursor: computed("CanvasText"),
      cursorAccent: computed("Canvas"),
      selectionBackground: computed("Highlight"),
      selectionForeground: computed("HighlightText"),
      red: computed("CanvasText")
    });
    expect(Object.hasOwn(appearance.theme, "green")).toBe(false);
    expect(appearance.theme.selectionBackground).toMatch(/^rgba?\(/u);
    expect(Object.hasOwn(TerminalThemeReader.read(createElement({ "--nol-terminal-selection": "Highlight" }), 13).theme, "selectionForeground")).toBe(false);
  });

  const inactive = (properties: Readonly<Record<string, string>>): string | undefined =>
    TerminalThemeReader.read(createElement(properties), 13).theme.selectionInactiveBackground;

  it("gives xterm an unfocused selection color in forced colors at 0.65 of the selection's opacity on a light palette, and at 0.7 of it on a dark one", async () => {
    await forceColorsAsync("light");

    const light: (string | undefined)[] = [
      inactive({ "color-scheme": "dark", "--nol-terminal-selection": "rgb(0 0 255 / 0.8)" }),
      inactive({ "--nol-terminal-selection": "color(display-p3 0 0 1)" })
    ];
    await forceColorsAsync("dark");
    const dark: string | undefined = inactive({ "--nol-terminal-selection": "rgb(0 0 255)" });

    expect([...light, dark]).toEqual(["rgba(0, 0, 255, 0.52)", "color(display-p3 0 0 1)", "rgba(0, 0, 255, 0.7)"]);
  });

  for (const { theme, canvas, highlight, isDark } of [
    new ContrastCase("Aquatic", "rgb(32, 32, 32)", "rgb(142, 227, 240)", true),
    new ContrastCase("Desert", "rgb(255, 250, 239)", "rgb(144, 57, 9)", false),
    new ContrastCase("Dusk", "rgb(45, 50, 54)", "rgb(161, 191, 222)", true),
    new ContrastCase("Night sky", "rgb(0, 0, 0)", "rgb(214, 180, 253)", true)
  ])
    it(`keeps an unfocused selection's fill at 3:1 against Canvas in the ${theme} contrast theme`, async () => {
      await forceColorsAsync(isDark ? "dark" : "light");
      const base: number[] = (canvas.match(/\d+/gu) ?? []).map(Number);
      const [red, green, blue, alpha] = (inactive({ "--nol-terminal-selection": highlight })?.match(/[\d.]+/gu) ?? []).map(Number);
      const opacity: number = Math.round((alpha ?? 1) * 255) / 255;
      const channel = (from: number, to: number): number => from + Math.round((to - from) * opacity);

      const fill: string = `rgb(${channel(base[0] ?? 0, red ?? 0)}, ${channel(base[1] ?? 0, green ?? 0)}, ${channel(base[2] ?? 0, blue ?? 0)})`;

      expect(Contrast.of(fill, canvas)).toBeGreaterThanOrEqual(3);
    });

  it("maps every ANSI color to its theme key, and selects in bright black without a selection or selected token", () => {
    const names: readonly string[] = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white", "bright-black", "bright-red", "bright-green",
      "bright-yellow", "bright-blue", "bright-magenta", "bright-cyan", "bright-white"];
    const values: readonly string[] = names.map((_, i) => `#0000${(i + 16).toString(16)}`);
    const theme: Readonly<Record<string, unknown>> = { ...TerminalThemeReader.read(createElement(Object.fromEntries(names.map((t, i) =>
      [`--nol-terminal-ansi-${t}`, values[i] ?? ""]))), 13).theme };

    expect([
      theme["black"], theme["red"], theme["green"], theme["yellow"], theme["blue"], theme["magenta"], theme["cyan"], theme["white"],
      theme["brightBlack"], theme["brightRed"], theme["brightGreen"], theme["brightYellow"], theme["brightBlue"], theme["brightMagenta"],
      theme["brightCyan"], theme["brightWhite"]
    ]).toEqual(values);
    expect(theme["selectionBackground"]).toBe("#000018");
  });

  it("colors each part of a typed command with its code token, and leaves a part whose token is unset or not a hex color", () => {
    const element: HTMLElement = createElement({
      "--nol-code-function": "#795E26",
      "--nol-error": "#A1260D",
      "--nol-code-keyword": " #0000ff ",
      "--nol-code-string": "#A31515",
      "--nol-code-type": "#247A93",
      "--nol-code-variable": "rgb(0, 16, 128)",
      "--nol-code-control": "#AF00DB",
      "--nol-code-comment": "#008000f0"
    });

    expect(TerminalThemeReader.readCommandColors(element))
      .toEqual(new CommandColors({ Command: "#795E26", NotFound: "#A1260D", Keyword: "#AF00DB", Option: "#0000ff", String: "#A31515", Path: "#247A93", Operator: "#AF00DB" }));
  });

  it("colors no part of a typed command in forced colors, where the kit colors no code", async () => {
    await forceColorsAsync();

    expect(TerminalThemeReader.readCommandColors(createElement({ "--nol-code-function": "#795E26" }))).toEqual(new CommandColors());
  });
});
