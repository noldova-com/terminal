/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { TerminalSize } from "@noldova/terminal.protocol";
import { FitAddon, type ITerminalDimensions } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { afterEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { PaneFitter } from "../../../src/app/services/pane-fitter.ts";

class FitHarness {
  public readonly host: HTMLElement = document.createElement("div");
  public readonly terminal: Terminal = new Terminal({ cols: 80, rows: 24, fontFamily: "monospace", fontSize: 16 });
  public readonly fit: FitAddon = new FitAddon();
  public readonly sent: string[] = [];
  public readonly fitter: PaneFitter;

  private readonly height: string;
  private readonly frames: Map<number, FrameRequestCallback> = new Map<number, FrameRequestCallback>();
  private lastFrame: number = 0;

  public constructor(isSizing: () => boolean = () => true, fixedRows: () => number | null = () => null, isShown: () => boolean = () => true,
    height: string = "20rem") {
    this.height = height;
    this.hide(false);
    document.body.append(this.host);
    this.terminal.loadAddon(this.fit);
    this.terminal.open(this.host);
    const cancel: (frame: number) => void = window.cancelAnimationFrame.bind(window);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      this.lastFrame -= 1;
      this.frames.set(this.lastFrame, callback);
      return this.lastFrame;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(frame => {
      if (!this.frames.delete(frame))
        cancel(frame);
    });
    this.fitter = new PaneFitter(this.terminal, this.fit, (size: TerminalSize) => this.sent.push(`${size.columns}x${size.rows}`), isSizing, fixedRows,
      isShown);
  }

  public get size(): string {
    return `${this.terminal.cols}x${this.terminal.rows}`;
  }

  public proposed(): ITerminalDimensions {
    const proposed: ITerminalDimensions | undefined = this.fit.proposeDimensions();
    if (Object.isUndefined(proposed))
      throw new Error("The fit proposed no size for the sized host.");
    return proposed;
  }

  public proposals(): MockInstance<FitAddon["proposeDimensions"]> {
    return vi.spyOn(this.fit, "proposeDimensions");
  }

  public hide(isHidden: boolean): void {
    this.host.style.display = isHidden ? "none" : "";
    this.host.style.width = isHidden ? "" : "40rem";
    this.host.style.height = isHidden ? "" : this.height;
  }

  public runFrame(): void {
    const callbacks: FrameRequestCallback[] = [...this.frames.values()];
    this.frames.clear();
    for (const callback of callbacks)
      callback(performance.now());
  }

  public dispose(): void {
    this.fitter.dispose();
    this.terminal.dispose();
    this.host.remove();
  }
}

describe("PaneFitter", () => {
  const harnesses: FitHarness[] = [];

  function createHarness(isSizing?: () => boolean, fixedRows?: () => number | null, isShown?: () => boolean, height?: string): FitHarness {
    const harness: FitHarness = new FitHarness(isSizing, fixedRows, isShown, height);
    harnesses.push(harness);
    return harness;
  }

  afterEach(() => {
    for (const harness of harnesses.splice(0))
      harness.dispose();
    vi.restoreAllMocks();
  });

  it("resizes the terminal to its box and reports the size once a frame, however often it is asked", () => {
    const harness: FitHarness = createHarness();
    const { cols, rows } = harness.proposed();
    const proposals: MockInstance<FitAddon["proposeDimensions"]> = harness.proposals();

    harness.fitter.request();
    harness.fitter.request();
    harness.runFrame();

    expect([proposals.mock.calls.length, harness.size]).toEqual([1, `${cols}x${rows}`]);
    expect(harness.sent).toEqual([`${cols}x${rows}`]);
    expect(harness.size).not.toBe("80x24");
  });

  it("reports the first fit's size though the terminal has it, so the runtime knows a pane sized the shell, and nothing for a later fit that changes nothing", () => {
    const harness: FitHarness = createHarness();
    const { cols, rows } = harness.proposed();
    harness.terminal.resize(cols, rows);

    harness.fitter.request();
    harness.runFrame();
    harness.fitter.request();
    harness.runFrame();

    expect([harness.sent, harness.size]).toEqual([[`${cols}x${rows}`], `${cols}x${rows}`]);
  });

  it("keeps the terminal's size for no proposal, as for a terminal out of its host", () => {
    const harness: FitHarness = createHarness();
    harness.terminal.element?.remove();

    harness.fitter.request();
    harness.runFrame();

    expect([harness.size, harness.sent.length]).toEqual(["80x24", 0]);
  });

  it("keeps the terminal's size for columns that are not a number, as for a pane with no box", () => {
    const harness: FitHarness = createHarness();
    harness.hide(true);

    harness.fitter.request();
    harness.runFrame();

    expect([harness.size, harness.sent.length]).toEqual(["80x24", 0]);
  });

  it("keeps the terminal's size for rows that are not a number", () => {
    const harness: FitHarness = createHarness();
    harness.proposals().mockReturnValue({ cols: 80, rows: Number.NaN });

    harness.fitter.request();
    harness.runFrame();

    expect([harness.size, harness.sent.length]).toEqual(["80x24", 0]);
  });

  it("reports the terminal's own size once for a pane that isn't shown and can't fit, so its shell starts there, and the fit's once it shows", () => {
    let isShown: boolean = false;
    const harness: FitHarness = createHarness(undefined, undefined, () => isShown);
    const { cols, rows } = harness.proposed();
    harness.hide(true);

    harness.fitter.request();
    harness.runFrame();
    harness.fitter.request();
    harness.runFrame();
    const hidden: string[] = [...harness.sent];
    isShown = true;
    harness.hide(false);
    harness.fitter.request();
    harness.runFrame();

    expect([hidden, harness.sent, harness.size]).toEqual([["80x24"], ["80x24", `${cols}x${rows}`], `${cols}x${rows}`]);
  });

  it("reports nothing for a pane that isn't shown once it has reported a fit", () => {
    let isShown: boolean = true;
    const harness: FitHarness = createHarness(undefined, undefined, () => isShown);
    const { cols, rows } = harness.proposed();

    harness.fitter.request();
    harness.runFrame();
    isShown = false;
    harness.hide(true);
    harness.fitter.request();
    harness.runFrame();

    expect([harness.sent, harness.size]).toEqual([[`${cols}x${rows}`], `${cols}x${rows}`]);
  });

  it("reports the next fit's size though it changes nothing once asked to report again, as a pane does when it attaches", () => {
    let isShown: boolean = false;
    const harness: FitHarness = createHarness(undefined, undefined, () => isShown);
    const { cols, rows } = harness.proposed();
    harness.hide(true);

    harness.fitter.request();
    harness.runFrame();
    harness.fitter.requestReport();
    harness.runFrame();
    isShown = true;
    harness.hide(false);
    harness.terminal.resize(cols, rows);
    harness.fitter.requestReport();
    harness.runFrame();
    harness.fitter.request();
    harness.runFrame();

    expect(harness.sent).toEqual(["80x24", "80x24", `${cols}x${rows}`]);
  });

  it("starts a shown pane too small for one row at the smallest size, and resizes it as the pane grows", () => {
    const harness: FitHarness = createHarness();
    const { cols, rows } = harness.proposed();
    harness.proposals().mockReturnValueOnce({ cols: 0, rows: 0 }).mockReturnValueOnce({ cols: 80, rows: 0 });

    harness.fitter.request();
    harness.runFrame();
    harness.fitter.request();
    harness.runFrame();
    harness.fitter.request();
    harness.runFrame();

    expect([harness.sent, harness.size]).toEqual([["1x1", "80x1", `${cols}x${rows}`], `${cols}x${rows}`]);
  });

  it("caps the size at the protocol's largest", () => {
    const harness: FitHarness = createHarness();
    harness.proposals().mockReturnValue({ cols: 5_000, rows: 2_000 });

    harness.fitter.request();
    harness.runFrame();

    expect(harness.sent).toEqual(["1000x1000"]);
  });

  it("fits nothing while another pane sizes the session's shell, and fits once it sizes it", () => {
    let isSizing: boolean = false;
    const harness: FitHarness = createHarness(() => isSizing);
    const { cols, rows } = harness.proposed();
    const proposals: MockInstance<FitAddon["proposeDimensions"]> = harness.proposals();

    harness.fitter.request();
    harness.runFrame();
    const following: (number | string | string[])[] = [proposals.mock.calls.length, harness.size, [...harness.sent]];
    isSizing = true;
    harness.fitter.request();
    harness.runFrame();

    expect(following).toEqual([0, "80x24", []]);
    expect([harness.size, harness.sent]).toEqual([`${cols}x${rows}`, [`${cols}x${rows}`]]);
  });

  it("fits only the columns of a pane with fixed rows, even when its box holds fewer rows", () => {
    const harness: FitHarness = createHarness(undefined, () => 15, undefined, "2rem");
    const { cols, rows } = harness.proposed();

    harness.fitter.request();
    harness.runFrame();

    expect(rows).toBeLessThan(15);
    expect(harness.sent).toEqual([`${cols}x15`]);
  });

  it("cancels a pending fit when disposed, and disposing twice is harmless", () => {
    const harness: FitHarness = createHarness();
    const proposals: MockInstance<FitAddon["proposeDimensions"]> = harness.proposals();

    harness.fitter.request();
    harness.fitter.dispose();
    harness.fitter.dispose();
    harness.runFrame();

    expect(proposals.mock.calls.length).toBe(0);
  });
});
