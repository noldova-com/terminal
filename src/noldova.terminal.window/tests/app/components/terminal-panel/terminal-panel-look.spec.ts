/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { TerminalNames, TerminalResizeParams, type TerminalSize } from "@noldova/terminal.protocol";
import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, KitStylesheetFixture } from "@noldova/ui.components.angular/testing";
import { Terminal, type IDisposable } from "@xterm/xterm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import { TerminalPanelComponent } from "../../../../src/app/components/terminal-panel/terminal-panel.component.ts";
import type { TerminalAppearance } from "../../../../src/app/models/terminal-appearance.ts";
import { TerminalThemeReader } from "../../../../src/app/services/terminal-theme-reader.ts";
import { Resources } from "../../../../src/resources.ts";
import { Contrast } from "../../../../tests/fixtures/contrast.fixture.ts";
import { DrawnWait } from "../../../../tests/fixtures/drawn-wait.fixture.ts";
import { PaneHost } from "../../../../tests/fixtures/pane-host.fixture.ts";
import { ScreenShot } from "../../../../tests/fixtures/screen-shot.fixture.ts";

describe("TerminalPanelComponent in the kit's look", () => {
  const screenshots: string = "../../../../../../_build/window/screenshots";
  const colors: readonly string[] = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
  const swatches = (first: number): string => colors.map((t, i) => `\u001b[${first + i}m${t}\u001b[0m`).join(" ");
  const output: string = [
    "\u001b[1;32mperson\u001b[0m:\u001b[1;34m~/work\u001b[0m$ ls",
    "\u001b[1;34msrc\u001b[0m  \u001b[1;34mtests\u001b[0m  \u001b[1;32mbuild.sh\u001b[0m  README.md",
    `\u001b[1;32mperson\u001b[0m:\u001b[1;34m~/work\u001b[0m$ ${swatches(30)}`,
    swatches(90),
    "\u001b[1;32mperson\u001b[0m:\u001b[1;34m~/work\u001b[0m$ exit"
  ].join("\r\n");
  const clear: string = "rgba(0, 0, 0, 0)";
  const windowBackground = (): string => getComputedStyle(document.body).backgroundColor;
  const borders: Readonly<Record<ThemeMode, string>> = { [ThemeMode.Light]: "rgb(229, 229, 229)", [ThemeMode.Dark]: "rgb(43, 43, 43)" };
  let host: PaneHost<TerminalPanelComponent> | null = null;
  let surface: HTMLElement | null = null;
  const inside = (inner: DOMRect, outer: DOMRect): boolean =>
    inner.left >= outer.left && inner.top >= outer.top && inner.right <= outer.right && inner.bottom <= outer.bottom;
  const framesAsync = (): Promise<void> => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  const forcedColorsAsync = (value: string, motion: string = "no-preference", scheme: string = "light"): Promise<unknown> => cdp().send("Emulation.setEmulatedMedia", {
    features: [
      { name: "prefers-color-scheme", value: scheme },
      { name: "prefers-contrast", value: "no-preference" },
      { name: "prefers-reduced-motion", value: motion },
      { name: "forced-colors", value }
    ]
  });
  const resolve = (color: string): string => {
    const probe: HTMLElement = document.createElement("span");
    probe.style.forcedColorAdjust = "none";
    probe.style.color = color;
    document.body.append(probe);
    const value: string = getComputedStyle(probe).color;
    probe.remove();
    return value;
  };

  const sizeOf = (shown: PaneHost<TerminalPanelComponent>): TerminalSize =>
    TerminalResizeParams.fromJson(shown.runtime.context.sent(TerminalNames.resizeMethod).at(-1) ?? null).size;

  const scrollbarOf = (shown: PaneHost<TerminalPanelComponent>): HTMLElement =>
    shown.element.querySelector<HTMLElement>("nol-terminal-pane .nol-terminal-pane-scrollbar") ?? shown.element;

  const shotAsync = (element: HTMLElement, name: string): Promise<ScreenShot> => ScreenShot.takeAsync(element, `${screenshots}/${name}.png`);

  const drawnAsync = async (element: HTMLElement, x: number, y: number, name: string): Promise<string> => (await shotAsync(element, name)).at(x, y);

  const plainRowAsync = async (pane: HTMLElement): Promise<number> => {
    const fontFamily: string = getComputedStyle(pane).getPropertyValue("--nol-font-mono").trim();
    const element: HTMLElement = document.createElement("div");
    document.body.append(element);
    const terminal: Terminal = new Terminal({ fontFamily, fontSize: 13, lineHeight: 1 });
    try {
      const rendered: Promise<void> = new Promise<void>(resolve => {
        const listener: IDisposable = terminal.onRender(() => {
          listener.dispose();
          resolve();
        });
      });
      terminal.open(element);
      await rendered;
      return (element.querySelector(".xterm-screen")?.getBoundingClientRect().height ?? 0) / terminal.rows;
    }
    finally {
      terminal.dispose();
      element.remove();
    }
  };

  afterEach(async () => {
    await cdp().send("Emulation.setEmulatedMedia", { features: [] });
    host?.fixture.destroy();
    host = null;
    surface?.remove();
    surface = null;
    AppearanceFixture.reset();
  });

  it.each(AppearanceFixture.modes)("draws a running and an ended shell on the window's background, painting none of its own, in %s mode, inset 6 by 8 pixels with lines 1.3 apart", async mode => {
    await KitStylesheetFixture.ensureAsync();
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const shown: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host = shown;
    shown.runtime.addSession("mine", "bash", "/work", null, false, true);
    await shown.attachedAsync();
    await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.resizeMethod)).not.toHaveLength(0), { timeout: DrawnWait.milliseconds });
    shown.runtime.output("mine", 0, output);
    await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.ackMethod).at(-1)).toEqual({ sessionId: "mine", paneId: expect.any(String), offset: output.length }),
      { timeout: DrawnWait.milliseconds });
    await framesAsync();
    await page.screenshot({ element: shown.element, path: `${screenshots}/terminal-panel-running-${mode.toLowerCase()}.png` });
    const size: TerminalSize = sizeOf(shown);
    const row: number = shown.screen.getBoundingClientRect().height / size.rows;
    shown.runtime.exitSession("mine", 0);
    await vi.waitFor(() => expect(shown.element.querySelector("nol-terminal-pane .nol-terminal-pane-ended button")).not.toBeNull(),
      { timeout: DrawnWait.milliseconds });
    await vi.waitFor(() => expect(shown.screen.getBoundingClientRect().bottom)
      .toBeLessThanOrEqual(shown.element.querySelector("nol-terminal-pane .nol-terminal-pane-ended")?.getBoundingClientRect().top ?? 0),
        { timeout: DrawnWait.milliseconds });
    await framesAsync();
    const paneElement: HTMLElement = shown.element.querySelector<HTMLElement>("nol-terminal-pane") ?? shown.element;
    const panel: DOMRect = shown.element.getBoundingClientRect();
    const pane: DOMRect = paneElement.getBoundingClientRect();
    const screen: DOMRect = shown.screen.getBoundingClientRect();
    const stripElement: HTMLElement = shown.element.querySelector<HTMLElement>("nol-terminal-pane .nol-terminal-pane-ended") ?? shown.element;
    const strip: DOMRect = stripElement.getBoundingClientRect();
    const stripStyle: CSSStyleDeclaration = getComputedStyle(stripElement);
    const text: DOMRect = (stripElement.querySelector<HTMLElement>(".nol-terminal-pane-ended-text") ?? stripElement).getBoundingClientRect();
    const button: DOMRect = (stripElement.querySelector<HTMLElement>("button") ?? stripElement).getBoundingClientRect();
    const viewport: HTMLElement = shown.element.querySelector<HTMLElement>("nol-terminal-pane .xterm-viewport") ?? shown.element;
    const plainRow: number = await plainRowAsync(paneElement);

    expect([getComputedStyle(shown.element).backgroundColor, getComputedStyle(paneElement).backgroundColor]).toEqual([clear, clear]);
    expect(await drawnAsync(shown.element, screen.left + 4, screen.bottom - 4, `terminal-panel-ended-background-${mode.toLowerCase()}`)).toBe(windowBackground());
    expect(screen.width).toBeGreaterThan(0);
    expect(screen.height).toBeGreaterThan(0);
    expect(inside(screen, panel)).toBe(true);
    expect(strip.height).toBeGreaterThan(0);
    expect(size.columns).toBeGreaterThan(1);
    expect(size.rows).toBeGreaterThan(1);
    expect([Math.round(screen.left - pane.left), Math.round(screen.top - pane.top)]).toEqual([8, 6]);
    expect(strip.top).toBeGreaterThanOrEqual(screen.bottom);
    expect([Math.round(strip.left - panel.left), Math.round(panel.right - strip.right), Math.round(panel.bottom - strip.bottom)]).toEqual([0, 0, 0]);
    expect([Math.round(text.left - strip.left), Math.round(strip.right - button.right)]).toEqual([12, 12]);
    expect([stripStyle.borderTopWidth, stripStyle.borderTopStyle, stripStyle.borderTopColor]).toEqual(["1px", "solid", borders[mode]]);
    const buttonStyle: CSSStyleDeclaration = getComputedStyle(stripElement.querySelector<HTMLElement>("button") ?? stripElement);
    expect([buttonStyle.backgroundColor, buttonStyle.borderTopWidth, buttonStyle.color]).toEqual([clear, "0px", resolve("var(--nol-text)")]);
    expect(getComputedStyle(viewport).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(plainRow).toBeGreaterThan(0);
    expect(row).toBeGreaterThan(1.3 * plainRow - 1);
    expect(row).toBeLessThanOrEqual(1.3 * plainRow);
    await page.screenshot({ element: shown.element, path: `${screenshots}/terminal-panel-ended-${mode.toLowerCase()}.png` });

    const tallest: DOMRect = text.height >= button.height ? text : button;
    expect([Math.round(tallest.top - strip.top), Math.round(strip.bottom - tallest.bottom)]).toEqual([5, 4]);
    expect(Math.abs(text.top + text.bottom - button.top - button.bottom)).toBeLessThan(2);
    shown.element.style.inlineSize = `${text.width + button.width + 30}px`;
    const wrappedStrip: DOMRect = stripElement.getBoundingClientRect();
    const wrappedText: DOMRect = (stripElement.querySelector<HTMLElement>(".nol-terminal-pane-ended-text") ?? stripElement).getBoundingClientRect();
    const wrappedButton: DOMRect = (stripElement.querySelector<HTMLElement>("button") ?? stripElement).getBoundingClientRect();
    expect([Math.round(wrappedButton.top - wrappedText.bottom), Math.round(wrappedButton.left - wrappedStrip.left)]).toEqual([12, 12]);
  });

  it.each(AppearanceFixture.modes)("keeps its scrollbar at the kit's size and look at the pane's end edge from top to bottom, its thumb travelling all of it, running and ended, and fits the shell inside the text's inset, in %s mode", async mode => {
    await KitStylesheetFixture.ensureAsync();
    await forcedColorsAsync("none", "reduce");
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const shown: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host = shown;
    shown.runtime.addSession("mine", "bash", "/work", null, false, true);
    await shown.attachedAsync();
    await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.resizeMethod)).not.toHaveLength(0), { timeout: DrawnWait.milliseconds });
    const lines: string = Array.from({ length: 80 }, (_, i) => `line ${i}`).join("\r\n");
    shown.runtime.output("mine", 0, lines);
    await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.ackMethod).at(-1)).toMatchObject({ offset: lines.length }),
      { timeout: DrawnWait.milliseconds });
    await framesAsync();
    const rem: number = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const boxElement: HTMLElement = shown.element.querySelector<HTMLElement>("nol-terminal-pane .nol-terminal-pane-screen") ?? shown.element;
    const scroller: HTMLElement = scrollbarOf(shown);
    const inRem = (pixels: number): number => Math.round(pixels / rem * 1000) / 1000 + 0;
    const slideAsync = async (key: "PageUp" | "PageDown"): Promise<void> => {
      const rows: number = sizeOf(shown).rows;
      const page: number = scroller.clientHeight / rows * Math.max(rows - 1, 1);
      const presses: number = Math.ceil((scroller.scrollHeight - scroller.clientHeight) / page);
      for (let i: number = 0; i < presses; i++)
        shown.press({ key, code: key, keyCode: key === "PageUp" ? 33 : 34, shiftKey: true });
      await vi.waitFor(() => expect(scroller.scrollTop).toBeCloseTo(key === "PageUp" ? 0 : scroller.scrollHeight - scroller.clientHeight, 0),
        { timeout: DrawnWait.milliseconds });
      await framesAsync();
    };
    const edgesOf = (bar: DOMRect, box: DOMRect): number[] => [bar.right - box.right, bar.top - box.top, bar.bottom - box.bottom].map(t => inRem(t));
    const flush: unknown[] = [expect.closeTo(0, 1), expect.closeTo(0, 1), expect.closeTo(0, 1)];
    const travelOf = (): number => Math.round(scroller.scrollTop / (scroller.scrollHeight - scroller.clientHeight) * 1000) / 1000;
    const size: TerminalSize = sizeOf(shown);
    const box: DOMRect = boxElement.getBoundingClientRect();
    const bar: DOMRect = scroller.getBoundingClientRect();
    const screen: DOMRect = shown.screen.getBoundingClientRect();
    const cell: { width: number; height: number } = { width: screen.width / size.columns, height: screen.height / size.rows };
    const room: { width: number; height: number } = { width: box.width - rem - bar.width, height: box.height - 0.75 * rem };
    await userEvent.hover(boxElement);
    await slideAsync("PageDown");
    const atEnd: number = travelOf();
    await slideAsync("PageUp");
    const atStart: number = travelOf();

    expect(inRem(bar.width)).toBe(0.375);
    expect(edgesOf(bar, box)).toEqual(flush);
    expect(scroller.scrollHeight / scroller.clientHeight).toBeCloseTo(80 / size.rows, 1);
    expect([atEnd, atStart]).toEqual([1, 0]);

    scroller.removeAttribute("data-nol-scrolling");
    const hovered: string = getComputedStyle(scroller).getPropertyValue("--nol-scroll-thumb");
    await userEvent.unhover(boxElement);
    await vi.waitFor(() => expect(boxElement.matches(":hover")).toBe(false), { timeout: DrawnWait.milliseconds });

    expect([hovered, getComputedStyle(scroller).getPropertyValue("--nol-scroll-thumb")]).toEqual([resolve("var(--nol-scrollbar)"), clear]);
    expect([inRem(screen.left - box.left), inRem(screen.top - box.top)]).toEqual([0.5, 0.375]);
    expect(screen.width).toBeLessThanOrEqual(room.width + 0.5);
    expect(screen.width + cell.width).toBeGreaterThan(room.width - 0.5);
    expect(screen.height).toBeLessThanOrEqual(room.height + 0.5);
    expect(screen.height + cell.height).toBeGreaterThan(room.height - 0.5);

    shown.runtime.exitSession("mine", 0);
    await vi.waitFor(() => expect(shown.element.querySelector("nol-terminal-pane .nol-terminal-pane-ended button")).not.toBeNull(),
      { timeout: DrawnWait.milliseconds });
    await vi.waitFor(() => expect(boxElement.getBoundingClientRect().bottom)
      .toBeLessThanOrEqual(shown.element.querySelector("nol-terminal-pane .nol-terminal-pane-ended")?.getBoundingClientRect().top ?? 0),
        { timeout: DrawnWait.milliseconds });
    await framesAsync();
    const ended: DOMRect = boxElement.getBoundingClientRect();
    const endedBar: DOMRect = scroller.getBoundingClientRect();
    const strip: DOMRect = shown.element.querySelector<HTMLElement>("nol-terminal-pane .nol-terminal-pane-ended")?.getBoundingClientRect() ?? new DOMRect();
    await slideAsync("PageDown");
    const endedAtEnd: number = travelOf();
    await slideAsync("PageUp");
    const endedAtStart: number = travelOf();

    expect(ended.height).toBeLessThan(box.height);
    expect(edgesOf(endedBar, ended)).toEqual(flush);
    expect(endedBar.bottom).toBeLessThanOrEqual(strip.top + 0.5);
    expect([endedAtEnd, endedAtStart]).toEqual([1, 0]);
  });

  it("keeps its scrollbar at the kit's size at the pane's end edge from top to bottom while forced colors are on", async () => {
    await KitStylesheetFixture.ensureAsync();
    AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light);
    const shown: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host = shown;
    shown.runtime.addSession("mine", "bash", "/work", null, false, true);
    await shown.attachedAsync();
    await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.resizeMethod)).not.toHaveLength(0), { timeout: DrawnWait.milliseconds });
    const lines: string = Array.from({ length: 80 }, (_, i) => `line ${i}`).join("\r\n");
    shown.runtime.output("mine", 0, lines);
    await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.ackMethod).at(-1)).toMatchObject({ offset: lines.length }),
      { timeout: DrawnWait.milliseconds });
    await forcedColorsAsync("active");
    await framesAsync();
    const rem: number = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const scroller: HTMLElement = scrollbarOf(shown);
    const box: DOMRect = shown.element.querySelector<HTMLElement>("nol-terminal-pane .nol-terminal-pane-screen")?.getBoundingClientRect() ?? new DOMRect();
    const bar: DOMRect = scroller.getBoundingClientRect();

    expect([bar.width / rem, bar.right - box.right, bar.top - box.top, bar.bottom - box.bottom]).toEqual([0.375, 0, 0, 0]);
    expect(scroller.scrollTop).toBeCloseTo(scroller.scrollHeight - scroller.clientHeight, 0);
  });

  it("draws the panel, the pane and the terminal's cells on Canvas while forced colors are on", async () => {
    await KitStylesheetFixture.ensureAsync();
    AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Dark);
    const shown: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host = shown;
    shown.runtime.addSession("mine", "bash", "/work", null, false, true);
    await shown.attachedAsync();
    await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.resizeMethod)).not.toHaveLength(0), { timeout: DrawnWait.milliseconds });
    shown.runtime.output("mine", 0, output);
    await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.ackMethod).at(-1)).toMatchObject({ offset: output.length }),
      { timeout: DrawnWait.milliseconds });
    await framesAsync();
    const paneElement: HTMLElement = shown.element.querySelector<HTMLElement>("nol-terminal-pane") ?? shown.element;
    const screen: DOMRect = shown.screen.getBoundingClientRect();
    const backgroundsAsync = async (name: string): Promise<string[]> => [
      getComputedStyle(shown.element).backgroundColor,
      getComputedStyle(paneElement).backgroundColor,
      await drawnAsync(shown.element, screen.left + 4, screen.bottom - 4, name)
    ];
    const kit: string = windowBackground();
    expect(await backgroundsAsync("terminal-panel-before-forced-colors")).toEqual([clear, clear, kit]);

    await forcedColorsAsync("active");
    const canvas: string = resolve("Canvas");
    expect(canvas).not.toBe(kit);
    await DrawnWait.untilAsync("The panel in forced colors", () => backgroundsAsync("terminal-panel-forced-colors"), [canvas, canvas, canvas]);
    await forcedColorsAsync("none");

    await DrawnWait.untilAsync("The panel after forced colors", () => backgroundsAsync("terminal-panel-after-forced-colors"), [clear, clear, kit]);
  });

  it.each(AppearanceFixture.modes.flatMap(mode => (["window", "panel"] as const).map(color => [mode, color] as const)))(
    "draws on its host's background and every ANSI color at a contrast of at least 4.5 there, in %s mode on the kit's %s color", async (mode, color) => {
      await KitStylesheetFixture.ensureAsync();
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const painted: HTMLElement = document.createElement("div");
      painted.style.backgroundColor = `var(--nol-${color})`;
      document.body.append(painted);
      surface = painted;
      const shown: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
      host = shown;
      painted.append(shown.element);
      shown.runtime.context.settings.set(Resources.fontSizeSetting, 40);
      shown.runtime.addSession("mine", "bash", "/work", null, false, true);
      await shown.attachedAsync();
      await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.resizeMethod)).not.toHaveLength(0), { timeout: DrawnWait.milliseconds });
      const ansi: readonly string[] = [...colors, ...colors.map(t => `bright ${t}`)];
      const glyphs: string = `${ansi.map((_, i) => `\u001b[${i < 8 ? 30 + i : 82 + i}mM`).join("")}\u001b[0m`;
      shown.runtime.output("mine", 0, glyphs);
      await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.ackMethod).at(-1)).toMatchObject({ offset: glyphs.length }),
        { timeout: DrawnWait.milliseconds });
      await framesAsync();
      const paneElement: HTMLElement = shown.element.querySelector<HTMLElement>("nol-terminal-pane") ?? shown.element;
      const size: TerminalSize = sizeOf(shown);
      const screen: DOMRect = shown.screen.getBoundingClientRect();
      const cell: { width: number; height: number } = { width: screen.width / size.columns, height: screen.height / size.rows };
      const background: string = getComputedStyle(painted).backgroundColor;
      const shot: { at: (x: number, y: number) => string; step: number } = await shotAsync(shown.element, `terminal-panel-on-${color}-${mode.toLowerCase()}`);
      const strongest = (column: number): number => {
        let most: number = 0;
        for (let y: number = screen.top; y < screen.top + cell.height; y += shot.step)
          for (let x: number = screen.left + column * cell.width; x < screen.left + (column + 1) * cell.width; x += shot.step)
            most = Math.max(most, Contrast.of(shot.at(x, y), background));
        return Math.round(most * 100) / 100;
      };
      const faint: readonly string[] = ansi.flatMap((name, i) => (strongest(i) < 4.5 ? [`${name} ${strongest(i)}`] : []));

      expect(size.columns).toBeGreaterThanOrEqual(ansi.length);
      expect(size.rows).toBeGreaterThan(1);
      expect([getComputedStyle(shown.element).backgroundColor, getComputedStyle(paneElement).backgroundColor, shot.at(screen.left + 4, screen.bottom - 4)])
        .toEqual([clear, clear, background]);
      expect(faint).toEqual([]);
    });

  it.each(AppearanceFixture.themes.flatMap(kitTheme => ([
    ["light mode", ThemeMode.Light, "none"],
    ["dark mode", ThemeMode.Dark, "none"],
    ["forced colors", ThemeMode.Dark, "active"]
  ] as const).map(([name, mode, forcedColors]) => [name, kitTheme.name, mode, forcedColors, kitTheme] as const)))(
    "draws its text, cursor and selection in the kit's terminal colors in %s under the %s theme", async (name, _themeName, mode, forcedColors, kitTheme) => {
      await KitStylesheetFixture.ensureAsync();
      AppearanceFixture.apply(kitTheme, mode);
      await forcedColorsAsync(forcedColors, "reduce");
      const shown: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
      host = shown;
      shown.runtime.addSession("mine", "bash", "/work", null, false, true);
      await shown.attachedAsync();
      await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.resizeMethod)).not.toHaveLength(0), { timeout: DrawnWait.milliseconds });
      shown.runtime.output("mine", 0, "$ ");
      await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.ackMethod).at(-1)).toMatchObject({ offset: 2 }),
        { timeout: DrawnWait.milliseconds });
      shown.textarea.focus();
      await framesAsync();
      const paneElement: HTMLElement = shown.element.querySelector<HTMLElement>("nol-terminal-pane") ?? shown.element;
      const theme: TerminalAppearance["theme"] = TerminalThemeReader.read(paneElement, 13).theme;
      const token = (name: string): string => resolve(`var(--nol-terminal-${name})`);
      const size: TerminalSize = sizeOf(shown);
      const screen: DOMRect = shown.screen.getBoundingClientRect();
      const cell: { width: number; height: number } = { width: screen.width / size.columns, height: screen.height / size.rows };

      const selectedText: string | undefined = Object.isUndefined(theme.selectionForeground) ? undefined : resolve(theme.selectionForeground);

      expect([getComputedStyle(paneElement).color, resolve(theme.cursor ?? ""), resolve(theme.selectionBackground ?? ""), selectedText])
        .toEqual([token("foreground"), token("cursor"), token("selection"), token("selection-foreground")]);
      await DrawnWait.untilAsync(`The cursor in ${name}`, () => drawnAsync(shown.element, screen.left + cell.width * 2.5, screen.top + cell.height / 2,
        `terminal-panel-cursor-${kitTheme.id}-${name.replaceAll(" ", "-")}`), token("cursor"));
    });

  it.each([ThemeMode.Light, ThemeMode.Dark])("draws the character under a focused block cursor at 4.5:1 or more against the default theme's cursor in %s mode", async mode => {
    await KitStylesheetFixture.ensureAsync();
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const shown: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host = shown;
    shown.runtime.context.settings.set(Resources.fontSizeSetting, 40);
    shown.runtime.addSession("mine", "bash", "/work", null, false, true);
    await shown.attachedAsync();
    await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.resizeMethod)).not.toHaveLength(0), { timeout: DrawnWait.milliseconds });
    const under: string = "M\u001b[D";
    shown.runtime.output("mine", 0, under);
    await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.ackMethod).at(-1)).toMatchObject({ offset: under.length }),
      { timeout: DrawnWait.milliseconds });
    shown.textarea.focus();
    await framesAsync();
    const size: TerminalSize = sizeOf(shown);
    const screen: DOMRect = shown.screen.getBoundingClientRect();
    const cell: { width: number; height: number } = { width: screen.width / size.columns, height: screen.height / size.rows };
    const cursor: string = resolve("var(--nol-terminal-cursor)");
    const accent: string = mode === ThemeMode.Light ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)";
    const underCursorAsync = async (): Promise<unknown> => {
      const shot: ScreenShot = await shotAsync(shown.element, `terminal-panel-cursor-accent-${mode.toLowerCase()}`);
      const pixels: string[] = shot.inside(screen.left, screen.top, cell.width, cell.height);
      return { cursor: pixels.includes(cursor), character: glyph(pixels, cursor) };
    };

    await DrawnWait.untilAsync(`The character under the cursor in ${mode} mode`, underCursorAsync, { cursor: true, character: accent });
    expect(Contrast.of(accent, cursor)).toBeGreaterThanOrEqual(4.5);
  });

  const selectionOver = (background: string, selection: string): string => {
    const base: number[] = (background.match(/[\d.]+/gu) ?? []).map(Number);
    const [red, green, blue, alpha] = (selection.match(/[\d.]+/gu) ?? []).map(Number);
    const opacity: number = Math.round((alpha ?? 1) * 255) / 255;
    const channel = (from: number, to: number): number => from + Math.round((to - from) * opacity);
    return `rgb(${channel(base[0] ?? 0, red ?? 0)}, ${channel(base[1] ?? 0, green ?? 0)}, ${channel(base[2] ?? 0, blue ?? 0)})`;
  };

  const squaresAsync = async (reference?: { text: string; background: string }): Promise<{
    drawnAsync: (name: string) => Promise<{ pixels: string[]; next: string[]; reference: string[]; empty: string; edges: string[] }>;
    select: () => void;
    blur: () => void;
  }> => {
    const shown: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host = shown;
    shown.runtime.addSession("mine", "bash", "/work", null, false, true);
    await shown.attachedAsync();
    await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.resizeMethod)).not.toHaveLength(0), { timeout: DrawnWait.milliseconds });
    const sgr = (code: number, color: string): string => `\u001b[${code};2;${(color.match(/\d+/gu) ?? []).slice(0, 3).join(";")}m`;
    const squares: string = `\u001b[31m■■\u001b[0m${Object.isUndefined(reference) ? ""
      : `\r\n\r\n${sgr(38, reference.text)}${sgr(48, reference.background)}■■\u001b[0m`}`;
    shown.runtime.output("mine", 0, squares);
    await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.ackMethod).at(-1)).toMatchObject({ offset: squares.length }),
      { timeout: DrawnWait.milliseconds });
    await framesAsync();
    const size: TerminalSize = sizeOf(shown);
    const screen: DOMRect = shown.screen.getBoundingClientRect();
    const cell: { width: number; height: number } = { width: screen.width / size.columns, height: screen.height / size.rows };
    return {
      drawnAsync: async name => {
        const shot: ScreenShot = await shotAsync(shown.element, name);
        const cellPixels = (column: number, row: number): string[] =>
          shot.inside(screen.left + cell.width * column, screen.top + cell.height * row, cell.width, cell.height);
        const middle: number = screen.left + cell.width * 5.5;
        return {
          pixels: cellPixels(0, 0),
          next: cellPixels(1, 0),
          reference: cellPixels(0, 2),
          empty: shot.at(middle, screen.top + cell.height / 2),
          edges: [
            shot.at(middle, screen.top + shot.step * 2),
            shot.at(middle, screen.top + cell.height - shot.step * 2),
            shot.at(middle, screen.top + cell.height + shot.step * 2),
            shot.at(screen.left + cell.width * (size.columns - 0.5), screen.top + cell.height / 2)
          ]
        };
      },
      select: () => {
        shown.textarea.focus();
        for (const type of ["mousedown", "mouseup"])
          shown.screen.dispatchEvent(new MouseEvent(type, {
            bubbles: true, cancelable: true, detail: 3, button: 0, clientX: screen.left + cell.width / 2, clientY: screen.top + cell.height / 2
          }));
      },
      blur: () => shown.textarea.blur()
    };
  };

  const glyph = (pixels: readonly string[], background: string): string | undefined => {
    const counts: Map<string, number> = new Map<string, number>();
    for (const pixel of pixels.filter(t => t !== background))
      counts.set(pixel, (counts.get(pixel) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };

  it.each(AppearanceFixture.themes.flatMap(theme => AppearanceFixture.modes.map(mode => [theme.name, mode, theme] as const)))(
    "draws a selected line's text in the %s theme's terminal selection text color, on its selection, in %s mode", async (_name, mode, theme) => {
      await KitStylesheetFixture.ensureAsync();
      AppearanceFixture.apply(theme, mode);
      const text: string = resolve("var(--nol-terminal-selection-foreground)");
      const background: string = windowBackground();
      const selection: string = selectionOver(background, resolve("var(--nol-terminal-selection)"));
      const { drawnAsync, select } = await squaresAsync({ text, background: selection });
      const shot: string = `terminal-panel-${theme.id}-${mode}`;
      const unselectedAsync = async (): Promise<unknown> => {
        const drawn: { pixels: string[]; next: string[]; reference: string[]; empty: string; edges: string[] } = await drawnAsync(`${shot}-unselected-text`);
        const drawnText: string | undefined = glyph(drawn.reference, selection);
        return {
          drawn: [!Object.isUndefined(drawnText), drawn.pixels.some(t => t !== drawn.empty)],
          text: [drawn.pixels, drawn.next].map(t => !Object.isUndefined(drawnText) && t.includes(drawnText)),
          edges: drawn.edges
        };
      };
      await DrawnWait.untilAsync(`The unselected line in the ${theme.name} theme in ${mode} mode`, unselectedAsync,
        { drawn: [true, true], text: [false, false], edges: [background, background, background, background] });

      select();

      const selectedAsync = async (): Promise<unknown> => {
        const drawn: { pixels: string[]; next: string[]; reference: string[]; empty: string; edges: string[] } = await drawnAsync(`${shot}-selected-text`);
        const drawnText: string | undefined = glyph(drawn.reference, selection);
        return {
          text: [drawn.pixels, drawn.next].map(t => !Object.isUndefined(drawnText) && t.includes(drawnText)),
          kit: drawn.pixels.includes(text),
          empty: drawn.empty,
          edges: drawn.edges
        };
      };
      await DrawnWait.untilAsync(`The selected line's text in the ${theme.name} theme in ${mode} mode`, selectedAsync,
        { text: [true, true], kit: Contrast.of(text, selection) >= 4.5, empty: selection, edges: [selection, selection, background, selection] });
    });

  const forcedAsync = async (drawnAsync: (name: string) => Promise<{ pixels: string[]; empty: string }>, name: string): Promise<{ own: boolean; text: boolean; empty: string }> => {
    const drawn: { pixels: string[]; empty: string } = await drawnAsync(name);
    return { own: drawn.pixels.includes(resolve("CanvasText")), text: drawn.pixels.includes(resolve("HighlightText")), empty: drawn.empty };
  };

  it.each(AppearanceFixture.themes.map(theme => [theme.name, theme] as const))(
    "draws a selected line in forced colors in HighlightText on Highlight, over its cells' own colors, under the %s theme", async (_name, theme) => {
      await KitStylesheetFixture.ensureAsync();
      AppearanceFixture.apply(theme, ThemeMode.Dark);
      await forcedColorsAsync("active");
      const { drawnAsync, select } = await squaresAsync();
      expect(await forcedAsync(drawnAsync, `terminal-panel-${theme.id}-forced-colors-unselected`)).toMatchObject({ own: true, empty: resolve("Canvas") });

      select();

      await DrawnWait.untilAsync(`The selected line in forced colors under the ${theme.name} theme`,
        () => forcedAsync(drawnAsync, `terminal-panel-${theme.id}-forced-colors-selected`),
        { own: false, text: true, empty: selectionOver(resolve("Canvas"), resolve("Highlight")) });
    });

  it.each([
    ["light", 0.65],
    ["dark", 0.7]
  ] as const)("dims an unfocused pane's selection in %s forced colors at 3:1 against Canvas, and draws it full again when the pane has focus", async (scheme, share) => {
    await KitStylesheetFixture.ensureAsync();
    AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Dark);
    await forcedColorsAsync("active", "no-preference", scheme);
    const { drawnAsync, select, blur } = await squaresAsync();
    const [red, green, blue, alpha] = (resolve("Highlight").match(/[\d.]+/gu) ?? []).map(Number);
    const focused: string = selectionOver(resolve("Canvas"), resolve("Highlight"));
    const unfocused: string = selectionOver(resolve("Canvas"), `rgba(${red ?? 0}, ${green ?? 0}, ${blue ?? 0}, ${(alpha ?? 1) * share})`);
    expect(unfocused).not.toBe(focused);
    const emptyAsync = (name: string): (() => Promise<string>) => async (): Promise<string> => (await drawnAsync(name)).empty;

    select();
    await DrawnWait.untilAsync("The focused pane's selection", emptyAsync(`terminal-panel-${scheme}-forced-colors-focused`), focused);
    blur();
    await DrawnWait.untilAsync("The unfocused pane's selection", emptyAsync(`terminal-panel-${scheme}-forced-colors-unfocused`), unfocused);
    expect(Contrast.of(unfocused, resolve("Canvas"))).toBeGreaterThanOrEqual(3);
    select();

    await DrawnWait.untilAsync("The pane's selection with focus again", emptyAsync(`terminal-panel-${scheme}-forced-colors-refocused`), focused);
  });

  it("redraws a selected line when forced colors turn on and off", async () => {
    await KitStylesheetFixture.ensureAsync();
    AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Dark);
    const { drawnAsync, select } = await squaresAsync();
    const kit: string = windowBackground();
    expect((await drawnAsync("terminal-panel-unselected")).empty).toBe(kit);
    select();
    let selected: { pixels: string[]; empty: string } | undefined;
    await vi.waitFor(async () => {
      selected = await drawnAsync("terminal-panel-selected");
      expect(selected.empty).not.toBe(kit);
    }, { timeout: DrawnWait.milliseconds });

    await forcedColorsAsync("active");
    await DrawnWait.untilAsync("The selected line once forced colors turn on", () => forcedAsync(drawnAsync, "terminal-panel-selected-forced-colors-on"),
      { own: false, text: true, empty: selectionOver(resolve("Canvas"), resolve("Highlight")) });
    await forcedColorsAsync("none");

    await DrawnWait.untilAsync("The selected line once forced colors turn off", () => drawnAsync("terminal-panel-selected-forced-colors-off"), selected);
  });
});
