/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { TestBed } from "@angular/core/testing";
import { Resources as ProtocolResources, TerminalInputEdge, TerminalInputMark, TerminalNames, TerminalResizeParams, type TerminalSize } from "@noldova/terminal.protocol";
import { AppearanceService, ModePreference, Typography } from "@noldova/ui.components.angular";
import { AppearanceFixture, KitStylesheetFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TerminalPanelComponent } from "../../../../src/app/components/terminal-panel/terminal-panel.component.ts";
import { Resources } from "../../../../src/resources.ts";
import { DrawnWait } from "../../../../tests/fixtures/drawn-wait.fixture.ts";
import { PaneHost } from "../../../../tests/fixtures/pane-host.fixture.ts";

describe("TerminalPaneComponent's suggestion of an earlier command", () => {
  const modes: readonly ModePreference[] = [ModePreference.Light, ModePreference.Dark];
  let host: PaneHost<TerminalPanelComponent> | null = null;

  afterEach(() => {
    host?.fixture.destroy();
    host = null;
    AppearanceFixture.reset();
  });

  const rem = (pixels: number): number => pixels / Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const paneOf = (shown: PaneHost<TerminalPanelComponent>): HTMLElement => shown.element.querySelector<HTMLElement>("nol-terminal-pane") ?? shown.element;
  const sizeOf = (shown: PaneHost<TerminalPanelComponent>): TerminalSize => {
    const sent: unknown = shown.runtime.context.sent(TerminalNames.resizeMethod).at(-1);
    if (Object.isUndefined(sent))
      throw new Error("The pane has sent no size yet.");
    return TerminalResizeParams.fromJson(sent).size;
  };
  const shownOf = (shown: PaneHost<TerminalPanelComponent>): HTMLElement | null => shown.element.querySelector<HTMLElement>(`.${Resources.suggestionClass}`);
  const rgbOf = (color: string): string => {
    const probe: HTMLElement = document.createElement("span");
    probe.style.color = color;
    document.body.append(probe);
    const value: string = getComputedStyle(probe).color;
    probe.remove();
    return value;
  };

  const openAsync = async (mode: ModePreference): Promise<PaneHost<TerminalPanelComponent>> => {
    await KitStylesheetFixture.ensureAsync();
    const shown: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host = shown;
    shown.runtime.commands = ["git status", "ls -la"];
    shown.runtime.addSession("mine", "bash", "/work", null, false, true);
    const appearance: AppearanceService = TestBed.inject(AppearanceService);
    appearance.setModePreference(mode);
    appearance.setTypography(new Typography());
    TestBed.tick();
    await shown.attachedAsync();
    await vi.waitFor(() => expect(sizeOf(shown).columns).toBeGreaterThan(0), { timeout: DrawnWait.milliseconds });
    shown.runtime.output("mine", 0, "$ ", [new TerminalInputMark(2, TerminalInputEdge.Start)]);
    shown.runtime.output("mine", 2, "git st");
    await vi.waitFor(() => expect(shownOf(shown)?.textContent).toBe("atus"), { timeout: DrawnWait.milliseconds });
    return shown;
  };

  it.each(modes)("draws the rest in the theme's bright black from the cursor's cell, a cell a character, in %s mode", async mode => {
    const shown: PaneHost<TerminalPanelComponent> = await openAsync(mode);
    const element: HTMLElement | null = shownOf(shown);
    expect(element).not.toBeNull();
    if (Object.isNull(element))
      return;

    const screen: DOMRect = shown.screen.getBoundingClientRect();
    const size: TerminalSize = sizeOf(shown);
    const cellWidth: number = screen.width / size.columns;
    const cellHeight: number = screen.height / size.rows;
    const box: DOMRect = element.getBoundingClientRect();
    expect(rem(box.left - screen.left)).toBeCloseTo(rem(8 * cellWidth), 2);
    expect(rem(box.top - screen.top)).toBeCloseTo(0, 2);
    expect(rem(box.height)).toBeCloseTo(rem(cellHeight), 2);
    const cells: DOMRect[] = [...element.children].map(t => t.getBoundingClientRect());
    expect(cells).toHaveLength(4);
    for (const [index, cell] of cells.entries()) {
      expect(rem(cell.left - screen.left)).toBeCloseTo(rem((8 + index) * cellWidth), 2);
      expect(rem(cell.width)).toBeCloseTo(rem(cellWidth), 2);
      expect(rem(cell.top - box.top)).toBeCloseTo(0, 2);
    }
    expect(getComputedStyle(element).color).toBe(rgbOf(getComputedStyle(paneOf(shown)).getPropertyValue("--nol-terminal-ansi-bright-black").trim()));
  });

  it("hides the rest while the setting is off, drops the earlier commands, and shows a command run since it turned on", async () => {
    const shown: PaneHost<TerminalPanelComponent> = await openAsync(ModePreference.Light);

    shown.runtime.context.changeSetting(ProtocolResources.suggestionsSetting, false);
    await vi.waitFor(() => expect(shownOf(shown)).toBeNull(), { timeout: DrawnWait.milliseconds });
    shown.press({ key: "ArrowRight", code: "ArrowRight", keyCode: 39 });
    shown.runtime.output("mine", 8, "\u0007");
    shown.runtime.context.changeSetting(ProtocolResources.suggestionsSetting, true);
    shown.runtime.addCommand("mine", "git stage");

    await vi.waitFor(() => expect(shownOf(shown)?.textContent).toBe("age"), { timeout: DrawnWait.milliseconds });
    expect(shown.inputs.at(-1)).toBe("\u001b[C");
  });

  it("sends the rest to the shell for → at the line's end, and hides it", async () => {
    const shown: PaneHost<TerminalPanelComponent> = await openAsync(ModePreference.Dark);

    shown.press({ key: "ArrowRight", code: "ArrowRight", keyCode: 39 });

    expect(shown.inputs.at(-1)).toBe("atus");
    await vi.waitFor(() => expect(shownOf(shown)).toBeNull(), { timeout: DrawnWait.milliseconds });
  });
});
