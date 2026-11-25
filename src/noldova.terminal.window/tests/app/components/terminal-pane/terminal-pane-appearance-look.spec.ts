/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { TestBed } from "@angular/core/testing";
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

class AppearanceCase {
  public readonly mode: ModePreference;
  public readonly change: IChange;

  public constructor(mode: ModePreference, change: IChange) {
    this.mode = mode;
    this.change = change;
  }
}

class PaneColors {
  public readonly background: string;
  public readonly yellow: string;

  public constructor(background: string, yellow: string) {
    this.background = background;
    this.yellow = yellow;
  }
}

class OpenedPane {
  public readonly shown: PaneHost<TerminalPanelComponent>;
  public readonly appearance: AppearanceService;

  public constructor(shown: PaneHost<TerminalPanelComponent>, appearance: AppearanceService) {
    this.shown = shown;
    this.appearance = appearance;
  }
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
  const cases: readonly AppearanceCase[] = modes.flatMap(mode => changes.map(change => new AppearanceCase(mode, change)));
  const clear: string = "rgba(0, 0, 0, 0)";
  let host: PaneHost<TerminalPanelComponent> | null = null;

  afterEach(() => {
    host?.fixture.destroy();
    host = null;
    AppearanceFixture.reset();
  });

  const paneOf = (shown: PaneHost<TerminalPanelComponent>): HTMLElement => shown.element.querySelector<HTMLElement>("nol-terminal-pane") ?? shown.element;

  const sizeOf = (shown: PaneHost<TerminalPanelComponent>): TerminalSize => {
    const sent: unknown = shown.runtime.context.sent(TerminalNames.resizeMethod).at(-1);
    if (Object.isUndefined(sent))
      throw new Error("The pane has sent no size yet.");
    return TerminalResizeParams.fromJson(sent).size;
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

  const expectedOf = (): PaneColors => new PaneColors(getComputedStyle(document.body).backgroundColor,
    rgbOf(getComputedStyle(document.documentElement).getPropertyValue("--nol-terminal-ansi-yellow").trim()));

  const drawnAsync = async (shown: PaneHost<TerminalPanelComponent>, name: string): Promise<PaneColors> => {
    const box: DOMRect = shown.element.getBoundingClientRect();
    const screen: DOMRect = shown.screen.getBoundingClientRect();
    const size: TerminalSize = sizeOf(shown);
    const cell: ICell = { width: screen.width / size.columns, height: screen.height / size.rows };
    const base64: string = (await page.screenshot({ element: shown.element, path: `${screenshots}/terminal-pane-${name}.png`, base64: true })).base64;
    const bitmap: ImageBitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
    const canvas: OffscreenCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context: OffscreenCanvasRenderingContext2D | null = canvas.getContext("2d");
    context?.drawImage(bitmap, 0, 0);
    const scale: number = bitmap.width / box.width;
    const at = (x: number, y: number): string => {
      const [red, green, blue] = context?.getImageData(Math.floor((x - box.left) * scale), Math.floor((y - box.top) * scale), 1, 1).data ?? [];
      return `rgb(${red}, ${green}, ${blue})`;
    };
    return new PaneColors(at(screen.left + cell.width * 2.5, screen.bottom - cell.height / 2), at(screen.left + cell.width * 4.5, screen.top + cell.height / 2));
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
    await vi.waitFor(() => expect(Math.abs(shown.screen.getBoundingClientRect().width / sizeOf(shown).columns - Math.floor(plain.width * devicePixelRatio) / devicePixelRatio))
      .toBeLessThan(0.01), { timeout: DrawnWait.milliseconds });
  };

  const openAsync = async (mode: ModePreference): Promise<OpenedPane> => {
    await KitStylesheetFixture.ensureAsync();
    const shown: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host = shown;
    shown.runtime.addSession("mine", "bash", "/work", null, false, true);
    const appearance: AppearanceService = TestBed.inject(AppearanceService);
    appearance.setModePreference(mode);
    appearance.setTypography(new Typography());
    TestBed.tick();
    await shown.attachedAsync();
    await vi.waitFor(() => expect(sizeOf(shown).columns).toBeGreaterThan(0), { timeout: DrawnWait.milliseconds });
    const block: string = "\u001b[43m          \u001b[0m\r\n";
    shown.runtime.output("mine", 0, block);
    await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.ackMethod).at(-1)).toMatchObject({ offset: block.length }),
      { timeout: DrawnWait.milliseconds });
    return new OpenedPane(shown, appearance);
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

  for (const { mode, change } of cases)
    it(`draws on the window's background in the theme's colors, at 13 pixels, in ${mode} mode, after ${change.name} changes while it is behind another tab`, async () => {
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
      const after: TerminalSize = sizeOf(shown);
      const screen: DOMRect = shown.screen.getBoundingClientRect();
      expect(Math.abs(screen.width / after.columns - Math.floor(plain.width * devicePixelRatio) / devicePixelRatio)).toBeLessThan(0.01);
      expect(screen.height / after.rows).toBeGreaterThan(1.3 * plain.height - 1);
      expect(screen.height / after.rows).toBeLessThanOrEqual(1.3 * plain.height);
    }, { timeout: DrawnWait.milliseconds });
  });
});
