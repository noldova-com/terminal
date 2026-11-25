/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Terminal } from "@xterm/xterm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RendererSwitch } from "../../../src/app/services/renderer-switch.ts";
import { Resources } from "../../../src/resources.ts";

class RendererHarness {
  public readonly host: HTMLElement = document.createElement("div");
  public readonly terminal: Terminal = new Terminal();
  public readonly logs: string[] = [];
  public readonly renderer: RendererSwitch = new RendererSwitch(this.terminal, t => this.logs.push(t));

  public open(): void {
    this.host.style.inlineSize = "40rem";
    this.host.style.blockSize = "20rem";
    document.body.append(this.host);
    this.terminal.open(this.host);
  }

  public get canvasCount(): number {
    return this.host.querySelectorAll("canvas").length;
  }

  public contextLostAsync(): Promise<void> {
    if (Object.isNull(this.host.querySelector("canvas")))
      throw new Error("The terminal drew no canvas to lose.");
    return new Promise<void>(resolve => this.host.addEventListener("webglcontextlost", () => resolve(), { capture: true, once: true }));
  }

  public loseContext(): void {
    for (const canvas of this.host.querySelectorAll("canvas"))
      canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
  }

  public dispose(): void {
    this.terminal.dispose();
    this.host.remove();
  }
}

describe("RendererSwitch", () => {
  const harnesses: RendererHarness[] = [];

  function createHarness(): RendererHarness {
    const harness: RendererHarness = new RendererHarness();
    harnesses.push(harness);
    return harness;
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    for (const harness of harnesses.splice(0))
      harness.dispose();
  });

  it("draws with WebGL while shown and gives the context back while hidden", () => {
    const harness: RendererHarness = createHarness();
    harness.open();

    harness.renderer.show();
    harness.renderer.show();
    const shownCanvases: number = harness.canvasCount;
    harness.renderer.hide();

    expect([harness.renderer.isWebgl, shownCanvases > 0, harness.canvasCount]).toEqual([false, true, 0]);
    harness.renderer.show();
    expect(harness.renderer.isWebgl).toBe(true);
  });

  it("keeps the DOM renderer and says why when WebGL can't load", () => {
    const harness: RendererHarness = createHarness();
    harness.open();
    const getContext: HTMLCanvasElement["getContext"] = HTMLCanvasElement.prototype.getContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement, kind: string, options?: unknown): RenderingContext | null {
      return kind === "webgl2" ? null : getContext.call(this, kind, options);
    });

    harness.renderer.show();
    harness.renderer.show();

    expect(harness.renderer.isWebgl).toBe(false);
    expect(harness.logs).toHaveLength(1);
    expect(harness.logs[0]).toMatch(/^The terminal draws with the DOM renderer, since WebGL failed: /u);
  });

  it("falls back to the DOM renderer for good when the WebGL context is lost", async () => {
    const harness: RendererHarness = createHarness();
    harness.open();
    harness.renderer.show();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const lost: Promise<void> = harness.contextLostAsync();

    harness.loseContext();
    await lost;
    await vi.runOnlyPendingTimersAsync();

    expect(harness.logs).toEqual([Resources.contextLost]);
    harness.renderer.show();
    expect([harness.renderer.isWebgl, harness.canvasCount]).toEqual([false, 0]);
  });
});
