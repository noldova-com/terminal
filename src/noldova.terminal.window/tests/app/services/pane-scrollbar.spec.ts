/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Terminal } from "@xterm/xterm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PaneScrollbar } from "../../../src/app/services/pane-scrollbar.ts";

describe("PaneScrollbar", () => {
  let host: HTMLElement;
  let bar: HTMLElement;
  let terminal: Terminal;
  let scrollbar: PaneScrollbar;

  const writeAsync = (data: string): Promise<void> => new Promise<void>(resolve => terminal.write(data, resolve));
  const scrolledAsync = (): Promise<unknown> => new Promise<unknown>(resolve => bar.addEventListener("scroll", resolve, { once: true }));
  const rangeOf = (): number => bar.scrollHeight;
  const linesAsync = (count: number): Promise<void> => writeAsync(Array.from({ length: count }, (_, i) => `line ${i}`).join("\r\n"));

  beforeEach(() => {
    host = document.body.appendChild(document.createElement("div"));
    bar = host.appendChild(document.createElement("div"));
    bar.tabIndex = -1;
    bar.style.cssText = "block-size: 200px; inline-size: 12px; overflow-x: hidden; overflow-y: auto";
    const screen: HTMLElement = host.appendChild(document.createElement("div"));
    terminal = new Terminal({ cols: 20, rows: 5, fontSize: 16, fontFamily: "monospace" });
    terminal.open(screen);
    scrollbar = new PaneScrollbar(terminal, bar);
  });

  afterEach(() => {
    scrollbar.dispose();
    terminal.dispose();
    host.remove();
  });

  it("holds one row of its own height for each of the buffer's lines, and shows the last rows after output", async () => {
    await linesAsync(20);

    expect([terminal.buffer.active.length, terminal.buffer.active.baseY]).toEqual([20, 15]);
    expect([rangeOf(), bar.scrollTop, bar.childElementCount]).toEqual([20 * 40, 15 * 40, 1]);
  });

  it("follows the terminal to the row it scrolls to", async () => {
    await linesAsync(20);

    terminal.scrollToLine(3);

    expect(bar.scrollTop).toBe(3 * 40);
  });

  it("scrolls the terminal to the row its position is nearest, and stays where the terminal's row already is", async () => {
    await linesAsync(20);
    const scrolled: Promise<unknown> = scrolledAsync();

    bar.scrollTop = 81;
    await scrolled;
    const moved: number = terminal.buffer.active.viewportY;
    const again: Promise<unknown> = scrolledAsync();
    bar.scrollTop = 90;
    await again;

    expect([moved, terminal.buffer.active.viewportY, bar.scrollTop]).toEqual([2, 2, 90]);
  });

  it("takes the rows' new height after a resize, and a range of one screen on the alternate screen", async () => {
    await linesAsync(20);

    terminal.resize(20, 10);
    const resizedRange: number = rangeOf();
    const resizedTop: number = bar.scrollTop;
    await writeAsync("\u001b[?1049h");

    expect([resizedRange, resizedTop]).toEqual([terminal.buffer.normal.length * 20, terminal.buffer.normal.baseY * 20]);
    expect([rangeOf(), bar.scrollTop]).toEqual([200, 0]);
  });

  it("takes its box's new height when asked to sync", async () => {
    await linesAsync(20);

    bar.style.blockSize = "100px";
    scrollbar.sync();

    expect([rangeOf(), bar.scrollTop]).toEqual([20 * 20, 15 * 20]);
  });

  it("leaves the terminal where it is while it has no height, as in a hidden pane", async () => {
    await linesAsync(20);
    bar.style.display = "none";

    scrollbar.sync();
    bar.dispatchEvent(new Event("scroll"));

    expect([bar.querySelector<HTMLElement>("div")?.style.height, terminal.buffer.active.viewportY]).toEqual(["0px", 15]);
  });

  it("gives a focus it gets back to the terminal", () => {
    bar.focus();

    expect(document.activeElement).toBe(terminal.textarea);
  });

  it("follows nothing and moves nothing once disposed", async () => {
    await linesAsync(20);
    scrollbar.dispose();

    terminal.scrollToLine(0);
    bar.dispatchEvent(new Event("scroll"));
    bar.focus();

    expect([bar.scrollTop, terminal.buffer.active.viewportY, document.activeElement]).toEqual([15 * 40, 0, bar]);
  });
});
