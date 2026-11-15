/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import type { JsonValue } from "@noldova/context.json";
import { TerminalNames, TerminalResizeParams, type TerminalSize } from "@noldova/terminal.protocol";
import { AppearanceService, FontChoice, ModePreference, Typography } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme, KitStylesheetFixture } from "@noldova/ui.components.angular/testing";
import { Terminal, type IDisposable } from "@xterm/xterm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { TerminalPanelComponent } from "../../../../src/app/components/terminal-panel/terminal-panel.component.ts";
import { DrawnWait } from "../../../../tests/fixtures/drawn-wait.fixture.ts";
import { PaneHost } from "../../../../tests/fixtures/pane-host.fixture.ts";

interface ICell {
  readonly width: number;
  readonly height: number;
}

interface IChange {
  readonly name: string;
  readonly apply: (appearance: AppearanceService, mode: ModePreference) => void;
}

describe("TerminalPaneComponent when the appearance changes", () => {
  const screenshots: string = "../../../../../../_build/window/screenshots";
  const modes: readonly ModePreference[] = [ModePreference.Light, ModePreference.Dark];
  const changes: readonly IChange[] = [
    { name: "the code font and Code text size", apply: t => t.setTypography(new Typography(13, 13, 17, FontChoice.Noldova, FontChoice.System)) },
    { name: "the panel text size", apply: t => t.setTypography(new Typography(17)) },
    { name: "the mode", apply: (t, mode) => t.setModePreference(mode === ModePreference.Dark ? ModePreference.Light : ModePreference.Dark) },
    { name: "the theme", apply: t => t.setTheme(FixtureTheme.theme) }
  ];
  const cases = modes.flatMap(mode => changes.map(change => [mode, change.name, change] as const));
  const clear: string = "rgba(0, 0, 0, 0)";
  let host: PaneHost<TerminalPanelComponent> | null = null;

  afterEach(() => {
    host?.fixture.destroy();
    host = null;
    AppearanceFixture.reset();
  });

  const paneOf = (shown: PaneHost<TerminalPanelComponent>): HTMLElement => shown.element.querySelector<HTMLElement>("nol-terminal-pane") ?? shown.element;

  const sizeOf = (shown: PaneHost<TerminalPanelComponent>): { cols: number; rows: number } => {
    const sent: JsonValue | undefined = shown.runtime.context.sent(TerminalNames.resizeMethod).at(-1);
    const size: TerminalSize | undefined = sent === undefined ? undefined : TerminalResizeParams.fromJson(sent).size;
    return { cols: size?.columns ?? 0, rows: size?.rows ?? 0 };
  };

  const rgbOf = (color: string): string => {
    const probe: HTMLElement = document.createElement("span");
    probe.style.color = color;
    document.body.append(probe);
    const value: string = getComputedStyle(probe).color;
    probe.remove();
    return value;
  };

  const backgroundsOf = (shown: PaneHost<TerminalPanelComponent>): string[] => [getComputedStyle(shown.element).backgroundColor, getComputedStyle(paneOf(shown)).backgroundColor];

  const expectedOf = (): { background: string; yellow: string } => ({
    background: getComputedStyle(document.body).backgroundColor,
    yellow: rgbOf(getComputedStyle(document.documentElement).getPropertyValue("--nol-terminal-ansi-yellow").trim())
  });

  const drawnAsync = async (shown: PaneHost<TerminalPanelComponent>, name: string): Promise<{ background: string; yellow: string }> => {
    const box: DOMRect = shown.element.getBoundingClientRect();
    const screen: DOMRect = shown.screen.getBoundingClientRect();
    const size: { cols: number; rows: number } = sizeOf(shown);
    const cell: ICell = { width: screen.width / size.cols, height: screen.height / size.rows };
    const shot: { base64: string } = await page.screenshot({ element: shown.element, path: `${screenshots}/terminal-pane-${name}.png`, base64: true });
    const bitmap: ImageBitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${shot.base64}`)).blob());
    const canvas: OffscreenCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context: OffscreenCanvasRenderingContext2D | null = canvas.getContext("2d");
    context?.drawImage(bitmap, 0, 0);
    const scale: number = bitmap.width / box.width;
    const at = (x: number, y: number): string => {
      const [red, green, blue] = context?.getImageData(Math.floor((x - box.left) * scale), Math.floor((y - box.top) * scale), 1, 1).data ?? [];
      return `rgb(${red}, ${green}, ${blue})`;
    };
    return {
      background: at(screen.left + cell.width * 2.5, screen.bottom - cell.height / 2),
      yellow: at(screen.left + cell.width * 4.5, screen.top + cell.height / 2)
    };
  };

  const plainCellAsync = async (pane: HTMLElement, fontSize: number): Promise<ICell> => {
    const fontFamily: string = getComputedStyle(pane).getPropertyValue("--nol-font-mono").trim();
    const element: HTMLElement = document.createElement("div");
    document.body.append(element);
    const terminal: Terminal = new Terminal({ fontFamily, fontSize, lineHeight: 1 });
    try {
      const rendered: Promise<void> = new Promise<void>(resolve => {
        const listener: IDisposable = terminal.onRender(() => {
          listener.dispose();
          resolve();
        });
      });
      terminal.open(element);
      await rendered;
      const screen: DOMRect = element.querySelector(".xterm-screen")?.getBoundingClientRect() ?? new DOMRect();
      return { width: screen.width / terminal.cols, height: screen.height / terminal.rows };
    }
    finally {
      terminal.dispose();
      element.remove();
    }
  };

  const expectThirteenAsync = async (shown: PaneHost<TerminalPanelComponent>): Promise<void> => {
    const plain: ICell = await plainCellAsync(paneOf(shown), 13);
    await vi.waitFor(() => expect(Math.abs(shown.screen.getBoundingClientRect().width / sizeOf(shown).cols - Math.floor(plain.width * devicePixelRatio) / devicePixelRatio))
      .toBeLessThan(0.01), { timeout: DrawnWait.milliseconds });
  };

  const openAsync = async (mode: ModePreference): Promise<{ shown: PaneHost<TerminalPanelComponent>; appearance: AppearanceService }> => {
    await KitStylesheetFixture.ensureAsync();
    const shown: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host = shown;
    shown.runtime.addSession("mine", "bash", "/work", null, false, true);
    const appearance: AppearanceService = TestBed.inject(AppearanceService);
    appearance.setModePreference(mode);
    appearance.setTypography(new Typography());
    TestBed.tick();
    await shown.attachedAsync();
    await vi.waitFor(() => expect(sizeOf(shown).cols).toBeGreaterThan(0), { timeout: DrawnWait.milliseconds });
    const block: string = "\u001b[43m          \u001b[0m\r\n";
    shown.runtime.output("mine", 0, block);
    await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.ackMethod).at(-1)).toMatchObject({ offset: block.length }),
      { timeout: DrawnWait.milliseconds });
    return { shown, appearance };
  };

  const changeBehindAsync = async (shown: PaneHost<TerminalPanelComponent>, change: () => void): Promise<void> => {
    const parent: HTMLElement | null = shown.element.parentElement;
    shown.shown.set(false);
    TestBed.tick();
    await PaneHost.takeOutAsync(shown.element);
    change();
    TestBed.tick();
    parent?.append(shown.element);
    shown.shown.set(true);
    TestBed.tick();
  };

  it.each(cases)("draws on the window's background in the theme's colors, at 13 pixels, in %s mode, after %s changes while it is behind another tab", async (mode, _name, change) => {
    const { shown, appearance } = await openAsync(mode);
    const name: string = `${mode}-${change.name}`.toLowerCase().replaceAll(" ", "-");

    await DrawnWait.untilAsync(`The pane before ${change.name} changes`, () => drawnAsync(shown, `${name}-before`), expectedOf());
    expect(backgroundsOf(shown)).toEqual([clear, clear]);
    await expectThirteenAsync(shown);

    await changeBehindAsync(shown, () => change.apply(appearance, mode));

    await DrawnWait.untilAsync(`The pane after ${change.name} changes`, () => drawnAsync(shown, `${name}-after`), expectedOf());
    expect(backgroundsOf(shown)).toEqual([clear, clear]);
    await expectThirteenAsync(shown);
  });

  it("keeps 13 pixels when the panel and Code text sizes change, and follows the code font, refitting the shell's columns", async () => {
    const { shown, appearance } = await openAsync(ModePreference.Light);
    await changeBehindAsync(shown, () => appearance.setTypography(new Typography(17, 13, 18, FontChoice.Noldova, FontChoice.System)));

    const plain: ICell = await plainCellAsync(paneOf(shown), 13);
    await vi.waitFor(() => {
      const after: { cols: number; rows: number } = sizeOf(shown);
      const screen: DOMRect = shown.screen.getBoundingClientRect();
      expect(Math.abs(screen.width / after.cols - Math.floor(plain.width * devicePixelRatio) / devicePixelRatio)).toBeLessThan(0.01);
      expect(screen.height / after.rows).toBeGreaterThan(1.3 * plain.height - 1);
      expect(screen.height / after.rows).toBeLessThanOrEqual(1.3 * plain.height);
    }, { timeout: DrawnWait.milliseconds });
  });
});
