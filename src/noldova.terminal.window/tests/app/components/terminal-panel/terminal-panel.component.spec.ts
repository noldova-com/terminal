/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { FocusTrapFactory, LiveAnnouncer, type FocusTrap } from "@angular/cdk/a11y";
import { ErrorHandler } from "@angular/core";
import { TestBed, type ComponentFixture } from "@angular/core/testing";
import { JsonException } from "@noldova/context.json";
import { EndedBy, TerminalExit, TerminalNames, TerminalPaneReference, TerminalResizeParams, TerminalRestartParams } from "@noldova/terminal.protocol";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { TerminalPanelComponent } from "../../../../src/app/components/terminal-panel/terminal-panel.component.ts";
import type { ITerminalRestartTarget } from "../../../../src/app/interfaces/i-terminal-restart-target.ts";
import { TerminalTabKey } from "../../../../src/app/models/terminal-tab-key.ts";
import { TerminalFocus } from "../../../../src/app/services/terminal-focus.ts";
import { TerminalRestartTargets } from "../../../../src/app/services/terminal-restart-targets.ts";
import { TerminalThemeReader } from "../../../../src/app/services/terminal-theme-reader.ts";
import { ErrorRecorder } from "../../../fixtures/error-recorder.fixture.ts";
import { FakeRuntime } from "../../../fixtures/fake-runtime.fixture.ts";
import { PaneHost } from "../../../fixtures/pane-host.fixture.ts";
import { SpecWait } from "../../../fixtures/spec-wait.fixture.ts";

function attachedSessions(host: PaneHost<TerminalPanelComponent>): readonly string[] {
  return host.runtime.context.sent(TerminalNames.attachMethod).map(t => TerminalPaneReference.fromJson(t).sessionId);
}

function tabMenuTarget(): ITerminalRestartTarget | undefined {
  return TerminalRestartTargets.find(TerminalTabKey.fromArguments({ tab: "view/terminal.panel" }));
}

function addField(): HTMLInputElement {
  const field: HTMLInputElement = document.body.appendChild(document.createElement("input"));
  onTestFinished(() => field.remove());
  return field;
}

describe("TerminalPanelComponent", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--nol-panel");
  });

  it("paints no background of its own or its pane's, so the terminal takes its host's, and follows it when the appearance changes", async () => {
    document.documentElement.style.setProperty("--nol-panel", "rgb(1, 2, 3)");
    const surface: HTMLElement = document.createElement("div");
    surface.style.backgroundColor = "var(--nol-panel)";
    document.body.append(surface);
    const host: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    surface.append(host.element);
    host.runtime.addSession("mine", "bash", "/work", null, false, true);
    host.fixture.detectChanges();
    await host.settleAsync();
    const pane: HTMLElement = await vi.waitFor(() => {
      const element: HTMLElement | null = host.element.querySelector<HTMLElement>("nol-terminal-pane");
      if (Object.isNull(element))
        throw new Error("The panel shows no pane yet.");
      return element;
    }, { timeout: SpecWait.milliseconds });
    const backgrounds = (): string[] => [getComputedStyle(host.element).backgroundColor, getComputedStyle(pane).backgroundColor, TerminalThemeReader.readBackground(pane)];

    expect(backgrounds()).toEqual(["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", "rgb(1, 2, 3)"]);
    document.documentElement.style.setProperty("--nol-panel", "rgb(4, 5, 6)");
    expect(backgrounds()).toEqual(["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", "rgb(4, 5, 6)"]);
    host.fixture.destroy();
    surface.remove();
  });

  it("waits until it first shows, then shows its own terminal, which it opened before a reload", async () => {
    const host: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, false);
    host.runtime.addSession("mine", "bash", "/work", null, false, true);
    host.runtime.addSession("tab", "bash", "/work");
    host.fixture.detectChanges();
    await host.settleAsync();
    expect(host.runtime.context.requests).toEqual([]);

    host.shown.set(true);
    await host.settleAsync();
    host.shown.set(false);
    await host.settleAsync();
    host.shown.set(true);
    await host.settleAsync();

    await vi.waitFor(() => expect(attachedSessions(host)).toEqual(["mine"]), { timeout: SpecWait.milliseconds });
    expect(host.runtime.context.sent(TerminalNames.sessionsMethod)).toHaveLength(1);
    expect(host.runtime.context.sent(TerminalNames.openMethod)).toEqual([]);
  });

  it("opens the default shell in the home folder as its own when the runtime lists none, and never shows a tab's or an agent's", async () => {
    const host: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host.runtime.addSession("tab", "bash", "/work");
    host.runtime.addSession("agent", "bash", "/work", null, true);

    await host.startAsync();

    await vi.waitFor(() => expect(attachedSessions(host)).toEqual(["opened-1"]), { timeout: SpecWait.milliseconds });
    expect(host.runtime.context.sent(TerminalNames.openMethod)).toEqual([
      { shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, isPanelTerminal: true, owner: null }
    ]);
  });

  it("shows one panel terminal in two panels that start while the first one's open is pending", async () => {
    const host: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host.runtime.holdOpens();
    host.fixture.detectChanges();
    const second: ComponentFixture<TerminalPanelComponent> = TestBed.createComponent(TerminalPanelComponent);
    const element: HTMLElement = PaneHost.hostOf(second);
    element.style.display = "block";
    element.style.inlineSize = "40rem";
    element.style.blockSize = "20rem";
    second.detectChanges();
    await vi.waitFor(() => expect(host.runtime.context.sent(TerminalNames.openMethod)).toHaveLength(2), { timeout: SpecWait.milliseconds });

    host.runtime.releaseOpens();

    await vi.waitFor(() => expect(attachedSessions(host)).toEqual(["opened-1", "opened-1"]), { timeout: SpecWait.milliseconds });
    expect(host.runtime.sessions.map(t => t.sessionId)).toEqual(["opened-1"]);
  });

  it("says why the shell could not start and offers to start again", async () => {
    const host: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host.runtime.openFailure = FakeRuntime.refusal("no shell found");
    host.fixture.detectChanges();

    await vi.waitFor(() => expect(host.element.querySelector(".ended")?.textContent).toContain("The terminal could not start: no shell found"), { timeout: SpecWait.milliseconds });
    host.runtime.openFailure = null;
    host.element.querySelector<HTMLButtonElement>(".ended button")?.click();

    await vi.waitFor(() => expect(attachedSessions(host)).toEqual(["opened-1"]), { timeout: SpecWait.milliseconds });
    expect(host.runtime.context.logs).toEqual(["The terminal could not start: no shell found"]);
    expect(host.element.querySelector(".ended")).toBeNull();
  });

  it("announces why its shell could not start through the window's one live region, and keeps its strip out of the live regions", async () => {
    const host: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    const announced = vi.spyOn(TestBed.inject(LiveAnnouncer), "announce");
    host.runtime.openFailure = FakeRuntime.refusal("no shell found");

    host.fixture.detectChanges();
    await vi.waitFor(() => expect(announced.mock.calls.map(t => t[0])).toEqual(["The terminal could not start: no shell found"]), { timeout: SpecWait.milliseconds });
    await Promise.all(announced.mock.results.map(t => t.value));

    const strip: HTMLElement = PaneHost.find(host.element, ".ended", HTMLElement);
    expect(document.querySelector(".cdk-live-announcer-element")?.textContent).toBe("The terminal could not start: no shell found");
    expect([strip.getAttribute("role"), strip.getAttribute("aria-live"), strip.closest("[aria-live]")]).toEqual([null, null, null]);
  });

  it("hands a malformed answer to its open to the window's error handler, rather than offering to start again", async () => {
    const errors: ErrorRecorder = new ErrorRecorder();
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.context.handlers.set(TerminalNames.openMethod, async () => ({ sessionId: 7 }));
    const host: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true, {}, runtime, [{ provide: ErrorHandler, useValue: errors }]);

    host.fixture.detectChanges();

    await vi.waitFor(() => expect(errors.errors.map(t => t instanceof JsonException)).toEqual([true]), { timeout: SpecWait.milliseconds });
    expect([host.runtime.context.logs, host.element.querySelector(".ended")]).toEqual([[], null]);
  });

  it("hands an open failure without the runtime's refusal code, such as a defect's TypeError, to the window's error handler, rather than offering to start again", async () => {
    const errors: ErrorRecorder = new ErrorRecorder();
    const runtime: FakeRuntime = new FakeRuntime();
    const defect: TypeError = new TypeError("sessions is undefined");
    runtime.openFailure = defect;
    const host: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true, {}, runtime, [{ provide: ErrorHandler, useValue: errors }]);

    host.fixture.detectChanges();

    await vi.waitFor(() => expect(errors.errors).toEqual([defect]), { timeout: SpecWait.milliseconds });
    expect([host.runtime.context.logs, host.element.querySelector(".ended")]).toEqual([[], null]);
  });

  it("starts its running shell again in place from the tab menu, at the pane's size, and gives the pane the focus", async () => {
    const host: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host.runtime.addSession("mine", "zsh", "/work/project", null, false, true);
    await host.startAsync();
    await vi.waitFor(() => expect(host.runtime.context.sent(TerminalNames.resizeMethod)).not.toHaveLength(0), { timeout: SpecWait.milliseconds });
    expect(tabMenuTarget()?.canRestart()).toBe(true);
    host.textarea.blur();

    await tabMenuTarget()?.restartAsync();

    const resized: unknown = host.runtime.context.sent(TerminalNames.resizeMethod).at(-1);
    expect(host.runtime.context.sent(TerminalNames.restartMethod).map(t => TerminalRestartParams.fromJson(t)))
      .toEqual([new TerminalRestartParams("mine", TerminalResizeParams.fromJson(resized).size)]);
    expect(document.activeElement).toBe(host.textarea);
    expect([attachedSessions(host), host.runtime.context.sent(TerminalNames.openMethod)]).toEqual([["mine"], []]);
  });

  it("starts a shell from the tab menu after its shell could not start, as Start again does", async () => {
    const host: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host.runtime.openFailure = FakeRuntime.refusal("no shell found");
    host.fixture.detectChanges();
    await vi.waitFor(() => expect(host.element.querySelector(".ended")).not.toBeNull(), { timeout: SpecWait.milliseconds });
    host.runtime.openFailure = null;

    expect(tabMenuTarget()?.canRestart()).toBe(true);
    await tabMenuTarget()?.restartAsync();

    await vi.waitFor(() => expect(attachedSessions(host)).toEqual(["opened-1"]), { timeout: SpecWait.milliseconds });
    expect(host.runtime.context.sent(TerminalNames.restartMethod)).toEqual([]);
  });

  it("offers no Restart in the tab menu before its pane has loaded, or once it is gone", async () => {
    const host: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, false);
    host.fixture.detectChanges();

    expect(tabMenuTarget()?.canRestart()).toBe(false);
    host.fixture.destroy();
    expect(tabMenuTarget()).toBeUndefined();
  });

  it("gives its pane the focus from Toggle Terminal, and from its pane gives the focus back and hides its dock", async () => {
    const host: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host.runtime.addSession("mine", "zsh", "/work/project", null, false, true);
    await host.startAsync();
    const field: HTMLInputElement = addField();
    field.focus();

    expect(await TerminalFocus.toggleAsync()).toBe(true);

    await vi.waitFor(() => expect(document.activeElement).toBe(host.textarea), { timeout: SpecWait.milliseconds });
    expect(host.runtime.context.hiddenDocks).toEqual([]);
    expect(await TerminalFocus.toggleAsync()).toBe(true);
    expect(document.activeElement).toBe(field);
    expect([host.runtime.context.hiddenDocks, host.runtime.context.shownViews]).toEqual([["terminal.panel"], []]);
  });

  it("shows itself from Toggle Terminal while it is hidden, and gives its pane the focus once it shows", async () => {
    const host: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host.runtime.addSession("mine", "zsh", "/work/project", null, false, true);
    await host.startAsync();
    const field: HTMLInputElement = addField();
    field.focus();
    host.shown.set(false);
    await host.settleAsync();

    expect(await TerminalFocus.toggleAsync()).toBe(true);

    expect([host.runtime.context.shownViews, document.activeElement === field]).toEqual([["terminal.panel"], true]);
    host.shown.set(true);
    await host.settleAsync();
    await vi.waitFor(() => expect(document.activeElement).toBe(host.textarea), { timeout: SpecWait.milliseconds });
  });

  it("has its terminal's input as the first element a tab's choice focuses", async () => {
    const host: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host.runtime.addSession("mine", "zsh", "/work/project", null, false, true);
    await host.startAsync();
    const trap: FocusTrap = TestBed.inject(FocusTrapFactory).create(host.element, true);

    expect(trap.focusFirstTabbableElement()).toBe(true);

    expect(document.activeElement).toBe(host.textarea);
    trap.destroy();
  });

  it("gives its pane the focus for its own terminal, and is passed by for another", async () => {
    const host: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host.runtime.addSession("mine", "zsh", "/work/project", null, false, true);
    await host.startAsync();
    const field: HTMLInputElement = addField();
    field.focus();

    expect(await TerminalFocus.showAsync("tab")).toBe(false);
    expect(document.activeElement).toBe(field);
    expect(await TerminalFocus.showAsync("mine")).toBe(true);

    await vi.waitFor(() => expect(document.activeElement).toBe(host.textarea), { timeout: SpecWait.milliseconds });
  });

  it("is passed by from Toggle Terminal while its shell couldn't start", async () => {
    const host: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host.runtime.openFailure = FakeRuntime.refusal("no shell found");
    host.fixture.detectChanges();
    await vi.waitFor(() => expect(host.element.querySelector(".ended")).not.toBeNull(), { timeout: SpecWait.milliseconds });

    expect(await TerminalFocus.toggleAsync()).toBe(false);
  });

  it("starts an ended shell again in place, in the same panel", async () => {
    const host: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true);
    host.runtime.addSession("mine", "zsh", "/work/project", null, false, true);
    host.runtime.exit = new TerminalExit(1, EndedBy.Exit);
    await host.startAsync();
    await vi.waitFor(() => expect(host.element.querySelector("nol-terminal-pane .nol-terminal-pane-ended button")).not.toBeNull(), { timeout: SpecWait.milliseconds });

    host.element.querySelector<HTMLButtonElement>("nol-terminal-pane .nol-terminal-pane-ended button")?.click();
    host.element.querySelector<HTMLButtonElement>("nol-terminal-pane .nol-terminal-pane-ended button")?.click();

    await vi.waitFor(() => expect(host.element.querySelector("nol-terminal-pane .nol-terminal-pane-ended")).toBeNull(), { timeout: SpecWait.milliseconds });
    expect(host.runtime.context.sent(TerminalNames.restartMethod)).toEqual([{ sessionId: "mine", size: { cols: expect.any(Number), rows: expect.any(Number) } }]);
    expect([attachedSessions(host), host.runtime.context.sent(TerminalNames.openMethod)]).toEqual([["mine"], []]);
  });
});
