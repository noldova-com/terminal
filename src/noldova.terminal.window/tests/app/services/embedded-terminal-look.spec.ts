/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EnvironmentInjector } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { ClipboardWriter, DefaultTheme } from "@noldova/ui.components.angular";
import { AppearanceFixture, ClipboardWriterFixture, KitStylesheetFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmbeddedTerminal } from "../../../src/app/services/embedded-terminal.ts";
import { TerminalPart } from "../../../src/app/services/terminal-part.ts";
import { DrawnWait } from "../../../tests/fixtures/drawn-wait.fixture.ts";
import { FakeRuntime } from "../../../tests/fixtures/fake-runtime.fixture.ts";
import { PaneHost } from "../../../tests/fixtures/pane-host.fixture.ts";

const ROWS: number = 5;

describe("EmbeddedTerminal's look", () => {
  let embedded: EmbeddedTerminal | null = null;
  let host: HTMLElement | null = null;
  let stopServing: () => void = () => undefined;

  afterEach(() => {
    embedded?.dispose();
    embedded = null;
    host?.remove();
    host = null;
    stopServing();
    AppearanceFixture.reset();
  });

  function rem(pixels: number): number {
    return pixels / Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  it.each(AppearanceFixture.modes)("keeps its text 0.5rem from its start edge and 0.375rem from its top and bottom edges in %s mode", async mode => {
    await KitStylesheetFixture.ensureAsync();
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.snapshot = "inset";
    runtime.offset = runtime.snapshot.length;
    stopServing = TerminalPart.serve(runtime.context);
    TestBed.configureTestingModule({ providers: [{ provide: ClipboardWriter, useValue: new ClipboardWriterFixture() }] });
    const opened: EmbeddedTerminal = EmbeddedTerminal.open("s1", TestBed.inject(EnvironmentInjector), ROWS);
    embedded = opened;
    const page: HTMLElement = document.createElement("div");
    host = page;
    page.style.inlineSize = "40rem";
    document.body.append(page);
    page.append(opened.element);
    await vi.waitFor(() => expect(opened.rows()).toBe(1), { timeout: DrawnWait.milliseconds });
    const screen: HTMLElement = await vi.waitFor(() => PaneHost.find(opened.element, ".xterm-screen", HTMLElement),
      { timeout: DrawnWait.milliseconds });
    await vi.waitFor(() => expect(PaneHost.lastSize(runtime)).toMatch(new RegExp(`x${ROWS}$`)), { timeout: DrawnWait.milliseconds });
    await vi.waitFor(() => {
      expect(screen.getBoundingClientRect().height).toBeGreaterThan(0);
      expect(rem(opened.element.getBoundingClientRect().height)).toBeCloseTo(rem(screen.getBoundingClientRect().height / ROWS) + 0.75, 2);
    }, { timeout: DrawnWait.milliseconds });
    const row: number = screen.getBoundingClientRect().height / ROWS;

    const box: DOMRect = opened.element.getBoundingClientRect();
    const drawn: DOMRect = screen.getBoundingClientRect();
    expect(rem(drawn.left - box.left)).toBeCloseTo(0.5, 2);
    expect(rem(drawn.top - box.top)).toBeCloseTo(0.375, 2);
    expect(rem(box.bottom - drawn.top - row)).toBeCloseTo(0.375, 2);
  });
});
