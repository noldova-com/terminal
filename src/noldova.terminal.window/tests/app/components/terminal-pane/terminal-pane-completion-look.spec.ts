/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { TestBed } from "@angular/core/testing";
import {
  TerminalCompleteParams,
  TerminalCompletion,
  TerminalCompletionItem,
  TerminalCompletionKind,
  TerminalInputEdge,
  TerminalInputMark,
  TerminalNames, TerminalResizeParams, type TerminalSize } from "@noldova/terminal.protocol";
import { AppearanceService, ModePreference, Typography } from "@noldova/ui.components.angular";
import { AppearanceFixture, KitStylesheetFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cdp } from "vitest/browser";

import { TerminalPanelComponent } from "../../../../src/app/components/terminal-panel/terminal-panel.component.ts";
import { Resources } from "../../../../src/resources.ts";
import { DrawnWait } from "../../../../tests/fixtures/drawn-wait.fixture.ts";
import { PaneHost } from "../../../../tests/fixtures/pane-host.fixture.ts";

describe("TerminalPaneComponent's completion list", () => {
  const modes: readonly ModePreference[] = [ModePreference.Light, ModePreference.Dark];
  const items: readonly TerminalCompletionItem[] = [
    new TerminalCompletionItem("--all", "--all", TerminalCompletionKind.Option),
    new TerminalCompletionItem("--almost-all", "--almost-all", TerminalCompletionKind.Option),
    new TerminalCompletionItem("--author", "--author", TerminalCompletionKind.Option)
  ];
  let host: PaneHost<TerminalPanelComponent> | null = null;

  const forcedColorsAsync = (value: string): Promise<unknown> => cdp().send("Emulation.setEmulatedMedia", {
    features: [
      { name: "prefers-color-scheme", value: "light" },
      { name: "prefers-contrast", value: "no-preference" },
      { name: "prefers-reduced-motion", value: "no-preference" },
      { name: "forced-colors", value }
    ]
  });

  afterEach(async () => {
    await cdp().send("Emulation.setEmulatedMedia", { features: [] });
    host?.fixture.destroy();
    host = null;
    AppearanceFixture.reset();
  });

  const rem = (pixels: number): number => pixels / Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const sizeOf = (shown: PaneHost<TerminalPanelComponent>): TerminalSize => {
    const sent: unknown = shown.runtime.context.sent(TerminalNames.resizeMethod).at(-1);
    if (Object.isUndefined(sent))
      throw new Error("The pane has sent no size yet.");
    return TerminalResizeParams.fromJson(sent).size;
  };
  const listOf = (shown: PaneHost<TerminalPanelComponent>): HTMLElement | null => shown.element.querySelector<HTMLElement>(`.${Resources.completionListClass}`);
  const rowsOf = (shown: PaneHost<TerminalPanelComponent>): HTMLElement[] => [...shown.element.querySelectorAll<HTMLElement>(`.${Resources.completionClass}`)];
  const labelsOf = (shown: PaneHost<TerminalPanelComponent>): string[] => rowsOf(shown).map(t => t.querySelector(`.${Resources.completionLabelClass}`)?.textContent ?? "");
  const resolve = (color: string): string => {
    const probe: HTMLElement = document.createElement("span");
    probe.style.forcedColorAdjust = "none";
    probe.style.color = color;
    document.body.append(probe);
    const value: string = getComputedStyle(probe).color;
    probe.remove();
    return value;
  };
  const tab = { key: "Tab", code: "Tab", keyCode: 9 };

  const openAsync = async (mode: ModePreference, choices: readonly TerminalCompletionItem[] = items, blockSize: string = "20rem"): Promise<PaneHost<TerminalPanelComponent>> => {
    await KitStylesheetFixture.ensureAsync();
    const shown: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host = shown;
    shown.element.style.blockSize = blockSize;
    shown.runtime.addSession("mine", "bash", "/work", null, false, true);
    shown.runtime.context.handlers.set(TerminalNames.completeMethod, async parameters =>
      new TerminalCompletion(TerminalCompleteParams.fromJson(parameters).cursor - 3, choices).toJson());
    const appearance: AppearanceService = TestBed.inject(AppearanceService);
    appearance.setModePreference(mode);
    appearance.setTypography(new Typography());
    TestBed.tick();
    await shown.attachedAsync();
    await vi.waitFor(() => expect(sizeOf(shown).columns).toBeGreaterThan(0), { timeout: DrawnWait.milliseconds });
    shown.runtime.output("mine", 0, "$ ", [new TerminalInputMark(2, TerminalInputEdge.Start)]);
    shown.runtime.output("mine", 2, "ls --a");
    await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.ackMethod).at(-1)).toMatchObject({ offset: 8 }),
      { timeout: DrawnWait.milliseconds });
    return shown;
  };
  const listAsync = async (shown: PaneHost<TerminalPanelComponent>): Promise<HTMLElement> => {
    shown.press(tab);
    await vi.waitFor(() => expect(listOf(shown)).not.toBeNull(), { timeout: DrawnWait.milliseconds });
    return listOf(shown) ?? shown.element;
  };

  it.each(modes)("opens under the word's first cell in the kit's menu look, rows 1.875rem tall, the first one active, in %s mode", async mode => {
    const shown: PaneHost<TerminalPanelComponent> = await openAsync(mode);
    const list: HTMLElement = await listAsync(shown);

    expect(shown.runtime.context.sent(TerminalNames.completeMethod)).toEqual([{ sessionId: "mine", line: "ls --a", cursor: 6, asksShell: true }]);
    expect(labelsOf(shown)).toEqual(["--all", "--almost-all", "--author"]);
    expect(rowsOf(shown).map(t => t.querySelector(`.${Resources.completionKindClass}`)?.textContent)).toEqual(["Option", "Option", "Option"]);
    const screen: DOMRect = shown.screen.getBoundingClientRect();
    const size: TerminalSize = sizeOf(shown);
    const cellWidth: number = screen.width / size.columns;
    const cellHeight: number = screen.height / size.rows;
    const box: DOMRect = list.getBoundingClientRect();
    expect(rem(box.left - screen.left)).toBeCloseTo(rem(5 * cellWidth), 2);
    expect(rem(box.top - screen.top)).toBeCloseTo(rem(cellHeight), 2);
    const style: CSSStyleDeclaration = getComputedStyle(list);
    expect(style.backgroundColor).toBe(resolve("var(--nol-menu)"));
    expect(style.borderTopColor).toBe(resolve("var(--nol-menu-border)"));
    expect(rem(Number.parseFloat(style.paddingTop))).toBeCloseTo(0.25, 3);
    const rows: DOMRect[] = rowsOf(shown).map(t => t.getBoundingClientRect());
    for (const [index, row] of rows.entries()) {
      expect(rem(row.height)).toBeCloseTo(1.875, 3);
      expect(rem(row.top - box.top)).toBeCloseTo(rem(1) + 0.25 + 1.875 * index, 2);
      expect(rem(row.left - box.left)).toBeCloseTo(rem(1), 2);
      expect(rem(box.right - row.right)).toBeCloseTo(rem(1), 2);
    }
    const first: HTMLElement | undefined = rowsOf(shown)[0];
    const label: DOMRect | undefined = first?.querySelector(`.${Resources.completionLabelClass}`)?.getBoundingClientRect();
    expect(rem((label?.left ?? 0) - (rows[0]?.left ?? 0))).toBeCloseTo(0.75, 2);
    const fill: CSSStyleDeclaration = getComputedStyle(first ?? list, "::before");
    expect(fill.backgroundColor).toBe(resolve("var(--nol-hover)"));
    expect([fill.top, fill.bottom, fill.left, fill.right].map(t => rem(Number.parseFloat(t)))).toEqual([0.125, 0.125, 0.25, 0.25]);
    expect(getComputedStyle(rowsOf(shown)[1] ?? list, "::before").backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(shown.textarea.getAttribute("aria-activedescendant")).toBe(first?.id);
    expect(list.role).toBe("listbox");
  });

  it("marks the active row with a 2-pixel Highlight outline while forced colors are on", async () => {
    const shown: PaneHost<TerminalPanelComponent> = await openAsync(ModePreference.Light);
    await forcedColorsAsync("active");
    await listAsync(shown);

    const fill: CSSStyleDeclaration = getComputedStyle(rowsOf(shown)[0] ?? shown.element, "::before");
    expect(fill.outlineStyle).toBe("solid");
    expect(fill.outlineWidth).toBe("2px");
    expect(fill.outlineColor).toBe(resolve("Highlight"));
    expect(getComputedStyle(rowsOf(shown)[1] ?? shown.element, "::before").outlineStyle).toBe("none");
  });

  const optionsOf = (count: number, label: (index: number) => string = index => `--all-${String(index).padStart(2, "0")}`): TerminalCompletionItem[] =>
    Array.from({ length: count }, (_, index) => new TerminalCompletionItem(label(index), label(index), TerminalCompletionKind.Option));
  const border = (list: HTMLElement): number => rem(Number.parseFloat(getComputedStyle(list).borderTopWidth));

  it("is 10rem wide, its least, for short choices", async () => {
    const shown: PaneHost<TerminalPanelComponent> = await openAsync(ModePreference.Light, optionsOf(2, index => `--a${index}`));
    expect(rem((await listAsync(shown)).getBoundingClientRect().width)).toBeCloseTo(10, 2);
  });

  it("is 30rem wide, its most, for a choice longer than that, without scrolling sideways", async () => {
    const shown: PaneHost<TerminalPanelComponent> = await openAsync(ModePreference.Light, optionsOf(1, () => `--a${"l".repeat(200)}`));
    const list: HTMLElement = await listAsync(shown);
    expect(rem(list.getBoundingClientRect().width)).toBeCloseTo(30, 2);
    expect(list.scrollWidth).toBe(list.clientWidth);
  });

  it("fills the room below the prompt in a pane of a few rows and scrolls the choices it can't show", async () => {
    const shown: PaneHost<TerminalPanelComponent> = await openAsync(ModePreference.Light, items, "6rem");
    const list: HTMLElement = await listAsync(shown);

    const room: DOMRect = (list.parentElement ?? list).getBoundingClientRect();
    const box: DOMRect = list.getBoundingClientRect();
    expect(sizeOf(shown).rows).toBeLessThan(items.length + 2);
    expect(rem(room.bottom - box.bottom)).toBeCloseTo(0, 2);
    expect(rem(box.height)).toBeLessThan(0.5 + 1.875 * items.length);
    expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
  });

  it("holds more than twelve choices to twelve rows and scrolls the active one into view", async () => {
    const choices: TerminalCompletionItem[] = optionsOf(20);
    const shown: PaneHost<TerminalPanelComponent> = await openAsync(ModePreference.Light, choices, "40rem");
    const list: HTMLElement = await listAsync(shown);

    expect(rowsOf(shown)).toHaveLength(20);
    expect(rem(list.getBoundingClientRect().height)).toBeCloseTo(0.5 + 1.875 * 12 + 2 * border(list), 2);
    expect(rem(list.clientHeight)).toBeCloseTo(0.5 + 1.875 * 12, 2);
    expect(list.scrollTop).toBe(0);

    for (let index: number = 0; index < 15; index++)
      shown.press({ key: "ArrowDown", code: "ArrowDown", keyCode: 40 });
    const active: HTMLElement | undefined = rowsOf(shown)[15];
    expect(shown.textarea.getAttribute("aria-activedescendant")).toBe(active?.id);
    TestBed.tick();
    expect(list.scrollTop).toBeGreaterThan(0);
    const box: DOMRect = list.getBoundingClientRect();
    const row: DOMRect = (active ?? list).getBoundingClientRect();
    expect(rem(row.top - box.top)).toBeGreaterThanOrEqual(border(list));
    expect(rem(row.bottom - box.top)).toBeCloseTo(border(list) + 0.5 + 1.875 * 12, 2);
  });

  it("opens above the cursor's row when the pane has no room below, kept inside the pane's end", async () => {
    const shown: PaneHost<TerminalPanelComponent> = await openAsync(ModePreference.Light);
    const size: TerminalSize = sizeOf(shown);
    shown.runtime.output("mine", 8, `${"\r\n".repeat(size.rows)}$ `, [new TerminalInputMark(10 + 2 * size.rows, TerminalInputEdge.Start)]);
    const typed: string = `${"x ".repeat(Math.floor(size.columns / 2) - 4)}--a`;
    shown.runtime.output("mine", 10 + 2 * size.rows, typed);
    await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.ackMethod).at(-1)).toMatchObject({ offset: 10 + 2 * size.rows + typed.length }),
      { timeout: DrawnWait.milliseconds });
    const list: HTMLElement = await listAsync(shown);

    const pane: DOMRect = (shown.element.querySelector(".nol-terminal-pane-screen") ?? list).getBoundingClientRect();
    const screen: DOMRect = shown.screen.getBoundingClientRect();
    const cellHeight: number = screen.height / size.rows;
    const box: DOMRect = list.getBoundingClientRect();
    expect(rem(screen.top + (size.rows - 1) * cellHeight - box.bottom)).toBeCloseTo(0, 2);
    expect(rem(pane.right - box.right)).toBeGreaterThanOrEqual(0);
    expect(rem(box.top - pane.top)).toBeGreaterThanOrEqual(0);
  });
});
