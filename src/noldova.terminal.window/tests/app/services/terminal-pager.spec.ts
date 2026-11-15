/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalLine, TerminalLineRange, TerminalLinesParams, TerminalNames, TerminalTextRun, TerminalTextStyle } from "@noldova/terminal.protocol";
import { Terminal, type IBuffer } from "@xterm/xterm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TerminalConnection } from "../../../src/app/services/terminal-connection.ts";
import { TerminalPager } from "../../../src/app/services/terminal-pager.ts";
import { Resources } from "../../../src/resources.ts";
import { DrawnWait } from "../../fixtures/drawn-wait.fixture.ts";
import { FakeRuntime } from "../../fixtures/fake-runtime.fixture.ts";
import { SpecWait } from "../../fixtures/spec-wait.fixture.ts";

const drawn: { timeout: number } = { timeout: DrawnWait.milliseconds };

describe("TerminalPager", () => {
  const screenRows: string[] = Array.from({ length: 30 }, (_t, index) => `row ${index + 1}`);
  let runtime: FakeRuntime;
  let terminal: Terminal;
  let pager: TerminalPager;
  let resetFailure: Error | null;

  const parsedAsync = (): Promise<void> => new Promise<void>(resolve => terminal.write("", resolve));
  const lines = (): string[] => {
    const buffer: IBuffer = terminal.buffer.active;
    return Array.from({ length: buffer.length }, (_t, index) => buffer.getLine(index)?.translateToString(true) ?? "").filter(t => t.length > 0);
  };
  const pageRequests = (): [number, number][] =>
    runtime.context.sent(TerminalNames.linesMethod).map(t => TerminalLinesParams.fromJson(t)).map(t => [t.start, t.limit]);
  const store = (count: number, stored: TerminalLineRange = new TerminalLineRange(0, count)): void => {
    runtime.storedLines = Array.from({ length: count }, (_t, index) => `stored ${index}`)
      .map(t => new TerminalLine(t, false, [new TerminalTextRun(t.length, 3, -1, TerminalTextStyle.Bold)]));
    runtime.stored = stored;
  };
  const startAsync = async (count: number, stored?: TerminalLineRange): Promise<void> => {
    store(count, stored);
    const opening: Promise<void> = pager.connection.openAsync();
    pager.connection.setVisible(true);
    await opening;
    await parsedAsync();
  };
  const scrollToTopAsync = async (expectedLines: number): Promise<void> => {
    terminal.scrollToLine(0);
    await vi.waitFor(() => expect(lines().length).toBe(expectedLines), drawn);
  };
  const leaveScreenAsync = async (): Promise<void> => {
    await startAsync(6500);
    for (let page: number = 1; page <= 13; page++)
      await scrollToTopAsync(page < 13 ? 500 * page + 30 : 6000);
  };

  beforeEach(() => {
    runtime = new FakeRuntime();
    runtime.snapshot = screenRows.join("\r\n");
    terminal = new Terminal({ cols: 80, rows: 24, scrollback: Resources.scrollback });
    const connection: TerminalConnection = new TerminalConnection(runtime.context, "s1", "p1", {
      drawAsync: t => pager.drawAsync(t),
      write: (data, written) => pager.write(data, written),
      markInput: () => undefined,
      addCommand: () => undefined,
      follow: t => pager.follow(t),
      showTitle: () => undefined,
      showCwd: () => undefined,
      showExit: () => undefined,
      showRunning: () => undefined,
      showLost: () => undefined
    });
    resetFailure = null;
    pager = new TerminalPager(terminal, connection, size => {
      const failure: Error | null = resetFailure;
      resetFailure = null;
      if (failure !== null)
        throw failure;
      terminal.reset();
      terminal.resize(size.columns, size.rows);
    }, t => runtime.context.log(t), 12);
    terminal.onScroll(t => pager.scroll(t));
    terminal.onData(t => pager.type(t));
  });

  afterEach(() => {
    pager.connection.close();
    terminal.dispose();
  });

  it("touches its terminal no more once its connection closed while a screen was being drawn", async () => {
    store(0);
    const held: (() => void)[] = [];
    const write: Terminal["write"] = terminal.write.bind(terminal);
    vi.spyOn(terminal, "write").mockImplementation((data: string | Uint8Array, callback?: () => void) => {
      if (data === "" && callback !== undefined)
        held.push(callback);
      else
        write(data, callback);
    });
    const reset = vi.spyOn(terminal, "reset");
    void pager.connection.openAsync();
    pager.connection.setVisible(true);
    await vi.waitFor(() => expect(held).toHaveLength(1), { timeout: SpecWait.milliseconds });

    pager.connection.close();
    held[0]?.();
    await new Promise<void>(resolve => write("", resolve));

    expect(reset).not.toHaveBeenCalled();
    expect(lines()).toEqual([]);
  });

  it("says how many older lines were dropped once the scroll reaches the first stored line", async () => {
    await startAsync(1700, new TerminalLineRange(1200, 1700, 1200));

    await scrollToTopAsync(531);

    expect(lines().slice(0, 2)).toEqual(["1,200 older lines were dropped", "stored 1200"]);
    expect(terminal.buffer.active.getLine(0)?.getCell(0)?.isDim()).not.toBe(0);
    expect(terminal.buffer.active.getLine(0)?.getCell(0)?.isItalic()).not.toBe(0);
    expect(Resources.formatDroppedLines(1)).toBe("1 older line was dropped");
  });

  it("loads the stored lines page by page when scrolled to the top, keeping the top line in place", async () => {
    await startAsync(1300);
    expect(terminal.buffer.active.viewportY).toBe(6);

    await scrollToTopAsync(530);
    expect(lines().slice(0, 2)).toEqual(["stored 800", "stored 801"]);
    expect(terminal.buffer.active.viewportY).toBe(500);
    expect(terminal.buffer.active.getLine(0)?.getCell(0)?.getFgColor()).toBe(3);
    await scrollToTopAsync(1030);
    await scrollToTopAsync(1330);
    terminal.scrollToLine(0);
    await parsedAsync();

    expect(pageRequests()).toEqual([[800, 500], [300, 500], [0, 300]]);
    expect(lines().length).toBe(1330);
    expect([lines()[0], lines()[1299], lines()[1300], lines().at(-1)]).toEqual(["stored 0", "stored 1299", "row 1", "row 30"]);
  });

  it("forgets loaded lines below a raised start and reads the rest from there", async () => {
    await startAsync(1300);
    await scrollToTopAsync(530);
    await scrollToTopAsync(1030);
    runtime.stored = new TerminalLineRange(700, 1300);
    runtime.output("s1", 0, "!");

    await scrollToTopAsync(630);
    terminal.scrollToLine(0);
    await parsedAsync();

    expect(pageRequests()).toEqual([[800, 500], [300, 500], [700, 100]]);
    expect(lines()[0]).toBe("stored 700");
    expect(lines().length).toBe(630);
  });

  it("keeps the live screen below its pages up to its cap and the top line in place, then leaves the screen behind past it, with room in xterm for every page until a new screen shows alone", async () => {
    await startAsync(6500);
    for (let page: number = 1; page <= 12; page++)
      await scrollToTopAsync(500 * page + 30);
    const underCap: [number, string[], number] = [terminal.buffer.active.viewportY, lines().slice(-30), terminal.options.scrollback ?? 0];

    await scrollToTopAsync(6000);
    const pastCap: [number, string | undefined, number] = [terminal.buffer.active.viewportY, lines().at(-1), terminal.options.scrollback ?? 0];
    terminal.input("ls\r");
    await vi.waitFor(() => expect(lines().slice(-30)).toEqual(screenRows), drawn);

    const back: [number, number] = [lines().length, terminal.options.scrollback ?? 0];
    TerminalConnection.reattachAll();
    await vi.waitFor(() => expect(lines()).toEqual(screenRows), drawn);

    expect(underCap).toEqual([500, screenRows, Resources.scrollback + 6000]);
    expect(pastCap).toEqual([500, "stored 5999", Resources.scrollback + 6000]);
    expect(back).toEqual([6030, Resources.scrollback + 6000]);
    expect(terminal.options.scrollback).toBe(Resources.scrollback);
  });

  it("makes room in xterm for the rows its pages wrap to at its columns, wide characters taking two cells, so the top stays put past 10,000 spare rows", async () => {
    runtime.storedLines = Array.from({ length: 5500 }, (_t, index) => `stored ${index} ${"字".repeat(140)}\u{1F600}`)
      .map(t => new TerminalLine(t, false, [new TerminalTextRun(t.length, 3, -1, TerminalTextStyle.Bold)]));
    runtime.stored = new TerminalLineRange(0, 5500);
    const opening: Promise<void> = pager.connection.openAsync();
    pager.connection.setVisible(true);
    await opening;
    await parsedAsync();

    for (let page: number = 1; page <= 10; page++)
      await scrollToTopAsync(2000 * page + 30);

    expect([lines()[0]?.startsWith("stored 500 "), terminal.buffer.active.viewportY, terminal.options.scrollback]).toEqual([true, 2000, Resources.scrollback + 20_000]);
  });

  it("leaves the screen behind beyond twelve pages, holds new output, and brings the screen back when scrolled down", async () => {
    await leaveScreenAsync();

    expect([lines()[0], lines().at(-1)]).toEqual(["stored 0", "stored 5999"]);
    runtime.output("s1", 0, "ignored\r\n");
    await parsedAsync();
    expect(lines().length).toBe(6000);
    await vi.waitFor(() => expect(runtime.context.sent(TerminalNames.ackMethod).at(-1)).toMatchObject({ offset: 9 }), { timeout: SpecWait.milliseconds });

    runtime.offset = 9;
    terminal.scrollToLine(terminal.buffer.active.baseY);
    await vi.waitFor(() => expect(lines().length).toBe(6030), drawn);

    expect([lines()[0], lines()[5999], lines()[6000], lines().at(-1)]).toEqual(["stored 500", "stored 6499", "row 1", "row 30"]);
    expect(terminal.buffer.active.viewportY).toBe(5500 - 24);
    runtime.output("s1", 9, "\r\ndrawn");
    await parsedAsync();
    expect(lines().at(-1)).toBe("drawn");
  });

  it("comes back to a fresh screen at the bottom when the person types while the screen is left behind", async () => {
    await leaveScreenAsync();

    terminal.input("ls\r");
    await vi.waitFor(() => expect(lines().slice(-30)).toEqual(screenRows), drawn);

    expect(runtime.context.sent(TerminalNames.inputMethod)).toEqual([{ sessionId: "s1", data: "ls\r" }]);
    expect(terminal.buffer.active.viewportY).toBe(terminal.buffer.active.baseY);
    expect(terminal.buffer.active.baseY).toBeGreaterThan(0);
  });

  it("writes output that arrives while a page loads once, below the new screen", async () => {
    await startAsync(1300);
    runtime.holdLines();

    terminal.scrollToLine(0);
    await vi.waitFor(() => expect(pageRequests()).toEqual([[800, 500]]), { timeout: SpecWait.milliseconds });
    runtime.output("s1", 0, "\r\nwhile loading");
    runtime.releaseLines();
    await vi.waitFor(() => expect(lines().length).toBe(531), drawn);

    expect([lines()[499], lines()[500], lines()[529], lines()[530]]).toEqual(["stored 1299", "row 1", "row 30", "while loading"]);
  });

  it("draws the next attach after one whose drawing failed", async () => {
    store(0);
    const failure: Error = new Error("reset failed");
    resetFailure = failure;
    const opening: Promise<void> = pager.connection.openAsync();
    pager.connection.setVisible(true);
    await opening;
    expect(runtime.context.logs).toEqual([Resources.formatDrawFailed(failure)]);

    TerminalConnection.reattachAll();

    await vi.waitFor(() => expect(lines()).toEqual(screenRows), drawn);
    expect(runtime.attachCount).toBe(2);
  });

  it("loads no page when it attaches again, though the terminal's reset scrolls to its top", async () => {
    await startAsync(1300);

    TerminalConnection.reattachAll();
    await vi.waitFor(() => expect(runtime.attachCount).toBe(2), { timeout: SpecWait.milliseconds });
    await parsedAsync();
    await parsedAsync();

    expect([pageRequests(), lines()]).toEqual([[], screenRows]);
  });

  it("sends every key typed while a page loads", async () => {
    await startAsync(1300);
    runtime.holdLines();

    terminal.scrollToLine(0);
    await vi.waitFor(() => expect(pageRequests()).toEqual([[800, 500]]), { timeout: SpecWait.milliseconds });
    terminal.input("l");
    terminal.input("s");
    terminal.input("\r");
    runtime.releaseLines();
    await vi.waitFor(() => expect(lines().length).toBe(530), drawn);

    expect(runtime.context.sent(TerminalNames.inputMethod)).toEqual(["l", "s", "\r"].map(t => ({ sessionId: "s1", data: t })));
  });

  it("draws the screen of an attach that came while a page loaded last, as when the runtime restarts and the page fails", async () => {
    const newRows: string[] = screenRows.map(t => `new ${t}`);
    await startAsync(1300);
    runtime.holdLines();

    terminal.scrollToLine(0);
    await vi.waitFor(() => expect(pageRequests()).toEqual([[800, 500]]), { timeout: SpecWait.milliseconds });
    runtime.snapshot = newRows.join("\r\n");
    TerminalConnection.reattachAll();
    await vi.waitFor(() => expect(runtime.attachCount).toBe(3), { timeout: SpecWait.milliseconds });
    await parsedAsync();
    runtime.linesFailure = new Error("restarted");
    runtime.releaseLines();
    await vi.waitFor(() => expect(runtime.context.logs).toEqual(["Paging the terminal's stored lines failed: restarted"]), { timeout: SpecWait.milliseconds });

    await vi.waitFor(() => expect(lines()).toEqual(newRows), drawn);
  });

  it("draws the new screen under the dropped lines' note when the runtime dropped the rest of its stored lines meanwhile", async () => {
    await startAsync(1300);
    runtime.stored = new TerminalLineRange(1300, 1300, 1300);

    terminal.scrollToLine(0);
    await vi.waitFor(() => expect(lines()).toEqual(["1,300 older lines were dropped", ...screenRows]), drawn);

    expect(pageRequests()).toEqual([[800, 500]]);
    terminal.scrollToLine(0);
    await parsedAsync();
    expect(pageRequests()).toEqual([[800, 500]]);
  });

  it("ignores scrolling before its first screen", async () => {
    store(1300);
    runtime.holdAttaches();
    const opening: Promise<void> = pager.connection.openAsync();
    pager.connection.setVisible(true);
    terminal.write(screenRows.join("\r\n"));
    await parsedAsync();

    terminal.scrollToLine(0);
    runtime.releaseAttaches();
    await opening;

    expect(pageRequests()).toEqual([]);
  });

  it("catches up the lines stored since its screen, then pages above them", async () => {
    await startAsync(1300);
    store(1400);

    await scrollToTopAsync(630);

    expect(pageRequests()).toEqual([[1300, 100], [800, 500]]);
    expect([lines()[0], lines()[599], lines()[600]]).toEqual(["stored 800", "stored 1399", "row 1"]);
    expect(terminal.buffer.active.viewportY).toBe(500);
  });

  it("starts from the newest page when far more lines were stored since its screen than it keeps", async () => {
    await startAsync(1300);
    store(8000);

    await scrollToTopAsync(530);

    expect(pageRequests()).toEqual([[7500, 500]]);
    expect([lines()[0], lines()[499], lines()[500]]).toEqual(["stored 7500", "stored 7999", "row 1"]);
  });

  it("stops at a start the runtime raised while it caught up", async () => {
    await startAsync(1300);
    store(1400, new TerminalLineRange(1300, 1400, 1300));

    await scrollToTopAsync(131);

    expect(pageRequests()).toEqual([[1300, 100]]);
    expect(lines().slice(0, 3)).toEqual(["1,300 older lines were dropped", "stored 1300", "stored 1301"]);
  });

  it("shows only the new screen when the runtime cleared its stored lines during a load", async () => {
    const newRows: string[] = screenRows.map(t => `new ${t}`);
    await startAsync(1300);
    store(1400);
    runtime.snapshot = newRows.join("\r\n");
    runtime.holdLines();

    terminal.scrollToLine(0);
    await vi.waitFor(() => expect(pageRequests()).toEqual([[1300, 100]]), { timeout: SpecWait.milliseconds });
    runtime.stored = new TerminalLineRange(1400, 1400);
    runtime.releaseLines();
    await vi.waitFor(() => expect(pageRequests()).toEqual([[1300, 100], [800, 500]]), { timeout: SpecWait.milliseconds });
    await vi.waitFor(() => expect(lines()).toEqual(newRows), drawn);

    expect(runtime.attachCount).toBe(2);
  });

  it("joins a line that wraps across two pages", async () => {
    await startAsync(1300);
    runtime.storedLines[800] = new TerminalLine("stored 800", true, [new TerminalTextRun(10, -1, -1, 0)]);

    await scrollToTopAsync(530);
    await scrollToTopAsync(1029);

    expect(lines().slice(498, 501)).toEqual(["stored 798", "stored 799stored 800", "stored 801"]);
  });

  it("keeps paging up while the screen is left behind, and stays put when scrolled between its ends", async () => {
    await startAsync(7000);
    for (let page: number = 1; page <= 13; page++)
      await scrollToTopAsync(page < 13 ? 500 * page + 30 : 6000);
    expect(lines()[0]).toBe("stored 500");

    terminal.scrollToLine(100);
    await parsedAsync();
    terminal.scrollToLine(0);
    await vi.waitFor(() => expect([lines()[0], lines().at(-1), lines().length]).toEqual(["stored 0", "stored 5999", 6000]), drawn);

    expect(runtime.attachCount).toBe(14);
    expect(pageRequests().slice(-2)).toEqual([[500, 500], [0, 500]]);
  });

  it("pages down while the screen is left behind and newer pages remain, then brings the screen back", async () => {
    await leaveScreenAsync();
    store(7100);
    runtime.output("s1", 0, "x");

    terminal.scrollToLine(terminal.buffer.active.baseY);
    await vi.waitFor(() => expect([lines()[0], lines().at(-1), lines().length]).toEqual(["stored 500", "stored 6499", 6000]), drawn);
    expect(runtime.attachCount).toBe(14);
    terminal.scrollToLine(terminal.buffer.active.baseY);
    await vi.waitFor(() => expect([lines()[0], lines().at(-1)]).toEqual(["stored 1000", "stored 6999"]), drawn);
    terminal.scrollToLine(terminal.buffer.active.baseY);
    await vi.waitFor(() => expect(lines().length).toBe(5630), drawn);

    expect([lines()[0], lines()[5599], lines()[5600], runtime.attachCount]).toEqual(["stored 1500", "stored 7099", "row 1", 15]);
  });

  it("stays behind when more lines were stored before the screen came, and comes back after reading them", async () => {
    await leaveScreenAsync();
    runtime.holdAttaches();

    terminal.scrollToLine(terminal.buffer.active.baseY);
    await vi.waitFor(() => expect(runtime.attachCount).toBe(15), { timeout: SpecWait.milliseconds });
    store(6600);
    runtime.releaseAttaches();
    await vi.waitFor(() => expect([lines()[0], lines().at(-1), lines().length]).toEqual(["stored 500", "stored 6499", 6000]), drawn);
    terminal.scrollToLine(terminal.buffer.active.baseY);
    await vi.waitFor(() => expect(lines().length).toBe(5630), drawn);

    expect([lines()[0], lines()[5599], lines()[5600]]).toEqual(["stored 1000", "stored 6599", "row 1"]);
  });

  it("comes back to the screen when the runtime dropped the pages below while the screen was left behind", async () => {
    await leaveScreenAsync();
    runtime.stored = new TerminalLineRange(6600, 6600, 6600);

    terminal.scrollToLine(terminal.buffer.active.baseY);
    await vi.waitFor(() => expect(lines()).toEqual(["6,600 older lines were dropped", ...screenRows]), drawn);

    expect(pageRequests().at(-1)).toEqual([6000, 500]);
  });

  it("comes back to the screen when scrolled down after the runtime cleared its stored lines while the screen was left behind", async () => {
    await leaveScreenAsync();
    runtime.stored = new TerminalLineRange(6500, 6500);
    runtime.output("s1", 0, "x");
    const reads: number = pageRequests().length;

    terminal.scrollToLine(terminal.buffer.active.baseY);
    await vi.waitFor(() => expect(lines()).toEqual(screenRows), drawn);

    expect([pageRequests().length, runtime.attachCount]).toEqual([reads, 15]);
  });

  it("stays as it is when the page above comes back empty while the screen is left behind", async () => {
    await startAsync(7000);
    for (let page: number = 1; page <= 13; page++)
      await scrollToTopAsync(page < 13 ? 500 * page + 30 : 6000);
    runtime.stored = new TerminalLineRange(1000, 7000, 1000);

    terminal.scrollToLine(0);
    await vi.waitFor(() => expect(pageRequests().at(-1)).toEqual([0, 500]), { timeout: SpecWait.milliseconds });
    await parsedAsync();

    expect([lines()[0], lines().at(-1), lines().length, runtime.attachCount]).toEqual(["stored 500", "stored 6499", 6000, 14]);
  });

  it("waits for the page it loads when typed into, then comes back at the bottom", async () => {
    await leaveScreenAsync();
    runtime.holdLines();

    terminal.scrollToLine(terminal.buffer.active.baseY);
    await vi.waitFor(() => expect(pageRequests().at(-1)).toEqual([6000, 500]), { timeout: SpecWait.milliseconds });
    terminal.input("x");
    runtime.releaseLines();
    await vi.waitFor(() => expect(lines().length).toBe(6030), drawn);
    await parsedAsync();

    expect(terminal.buffer.active.viewportY).toBe(terminal.buffer.active.baseY);
    expect([runtime.attachCount, runtime.context.sent(TerminalNames.inputMethod)]).toEqual([15, [{ sessionId: "s1", data: "x" }]]);
  });

  it("shows the live screen when a page can't be read", async () => {
    await startAsync(1300);
    runtime.linesFailure = new Error("unreadable");

    terminal.scrollToLine(0);
    await vi.waitFor(() => expect(runtime.context.logs).toEqual(["Paging the terminal's stored lines failed: unreadable"]), { timeout: SpecWait.milliseconds });
    await parsedAsync();
    expect(lines()).toEqual(screenRows);
    runtime.output("s1", 0, "\r\nstill live");
    await parsedAsync();
    expect(lines().at(-1)).toBe("still live");
  });

  it("keeps its pages when it can't read further while the screen is left behind, and comes back when typed into", async () => {
    await leaveScreenAsync();
    runtime.linesFailure = new Error("unreadable");

    terminal.scrollToLine(terminal.buffer.active.baseY);
    await vi.waitFor(() => expect(runtime.context.logs).toEqual(["Paging the terminal's stored lines failed: unreadable"]), { timeout: SpecWait.milliseconds });
    expect([lines()[0], lines().at(-1), lines().length]).toEqual(["stored 0", "stored 5999", 6000]);

    terminal.input("x");
    await vi.waitFor(() => expect(lines()).toEqual(screenRows), drawn);
  });
});
