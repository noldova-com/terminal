/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FocusTrapFactory, type FocusTrap } from "@angular/cdk/a11y";
import { ErrorHandler, type Provider } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { JsonException } from "@noldova/context.json";
import { DockSide } from "@noldova/desktop.window";
import {
  EndedBy, TerminalExit, TerminalNames, TerminalPaneReference, TerminalResizeParams, TerminalRestartParams, TerminalSessions, type TerminalSize
} from "@noldova/terminal.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { TerminalSessionComponent } from "../../../../src/app/components/terminal-session/terminal-session.component.ts";
import type { ITerminalRestartTarget } from "../../../../src/app/interfaces/i-terminal-restart-target.ts";
import { TerminalTabKey } from "../../../../src/app/models/terminal-tab-key.ts";
import { TerminalDockGrowths } from "../../../../src/app/services/terminal-dock-growths.ts";
import { TerminalFocus } from "../../../../src/app/services/terminal-focus.ts";
import { TerminalRestartTargets } from "../../../../src/app/services/terminal-restart-targets.ts";
import { TerminalRuntimeClient } from "../../../../src/app/services/terminal-runtime-client.ts";
import { ErrorRecorder } from "../../../fixtures/error-recorder.fixture.ts";
import { FakeRuntime } from "../../../fixtures/fake-runtime.fixture.ts";
import { PaneHost } from "../../../fixtures/pane-host.fixture.ts";
import { SpecWait } from "../../../fixtures/spec-wait.fixture.ts";

const SOON: { readonly interval: number; readonly timeout: number } = { interval: 1, timeout: SpecWait.milliseconds };

function createSession(runtime: FakeRuntime = new FakeRuntime(), providers: readonly Provider[] = []): PaneHost<TerminalSessionComponent> {
  return new PaneHost(TerminalSessionComponent, true, { instance: "s1", title: "Terminal" }, runtime, providers);
}

function restartsOf(host: PaneHost<TerminalSessionComponent>): readonly TerminalRestartParams[] {
  return host.runtime.context.sent(TerminalNames.restartMethod).map(t => TerminalRestartParams.fromJson(t));
}

function tabMenuTarget(): ITerminalRestartTarget | undefined {
  return TerminalRestartTargets.find(TerminalTabKey.fromArguments({ tab: "view/terminal.session/s1" }));
}

function dock(host: PaneHost<TerminalSessionComponent>, side: DockSide | null): void {
  host.runtime.context.dock.set(side);
}

function lastSize(host: PaneHost<TerminalSessionComponent>): TerminalSize | undefined {
  const sent: unknown = host.runtime.context.sent(TerminalNames.resizeMethod).at(-1);
  return sent === undefined ? undefined : TerminalResizeParams.fromJson(sent).size;
}

function addField(): HTMLInputElement {
  const field: HTMLInputElement = document.body.appendChild(document.createElement("input"));
  onTestFinished(() => field.remove());
  return field;
}

describe("TerminalSessionComponent", () => {
  it("shows its session and keeps its tab titled Terminal whatever the program calls itself", async () => {
    const host: PaneHost<TerminalSessionComponent> = createSession();
    host.runtime.title = "vim notes.md";

    await host.attachedAsync();
    host.runtime.retitle("s1", "less log.txt");

    expect(host.runtime.context.sent(TerminalNames.attachMethod)).toEqual([{ sessionId: "s1", paneId: expect.any(String) }]);
    expect(host.runtime.context.updates).toEqual([]);
  });

  it("grows its tab's bottom dock once for a launch's minimum rows, as Noldova Desktop names the dock that holds it, in rem, a height at which the pane shows all those rows inside its screen's inset, until the ask is released", async () => {
    const release: () => void = TerminalDockGrowths.ask("s1", 30);
    try {
      const host: PaneHost<TerminalSessionComponent> = createSession();
      dock(host, DockSide.Bottom);
      await host.attachedAsync();
      await vi.waitFor(() => expect(host.runtime.context.grownDocks).toHaveLength(1), SOON);
      await vi.waitFor(() => expect(PaneHost.lastSize(host.runtime)).not.toBe(""), SOON);

      const screen: HTMLElement = PaneHost.find(host.element, ".nol-terminal-pane-screen", HTMLElement);
      const minimum: number = host.runtime.context.grownDocks[0]?.[1] ?? 0;
      host.element.style.blockSize = `calc(${minimum}rem + 0.5px)`;
      await vi.waitFor(() => expect(PaneHost.lastSize(host.runtime).split("x")[1]).toBe("30"), SOON);
      expect(host.runtime.context.grownDocks.map(([tab]) => tab)).toEqual(["terminal.session/s1"]);
      expect(Number.parseFloat(getComputedStyle(screen).paddingTop)).toBeGreaterThan(0);
      expect(host.runtime.context.releasedDocks).toEqual([]);
      release();
      expect([host.runtime.context.grownDocks.length, host.runtime.context.releasedDocks]).toEqual([1, ["terminal.session/s1"]]);
    }
    finally {
      release();
    }
  });

  it("grows no side dock, whose width would grow, for a launch's minimum rows", async () => {
    const release: () => void = TerminalDockGrowths.ask("s1", 30);
    try {
      const host: PaneHost<TerminalSessionComponent> = createSession();
      dock(host, DockSide.Left);
      await host.attachedAsync();
      await vi.waitFor(() => expect(PaneHost.lastSize(host.runtime)).not.toBe(""), SOON);

      expect(host.runtime.context.grownDocks).toEqual([]);
    }
    finally {
      release();
    }
  });

  it("grows no dock for a launch's minimum rows while its tab is among the documents, where Noldova Desktop names no dock", async () => {
    const release: () => void = TerminalDockGrowths.ask("s1", 30);
    try {
      const host: PaneHost<TerminalSessionComponent> = createSession();
      dock(host, null);
      await host.attachedAsync();
      await vi.waitFor(() => expect(PaneHost.lastSize(host.runtime)).not.toBe(""), SOON);

      expect(host.runtime.context.grownDocks).toEqual([]);
    }
    finally {
      release();
    }
  });

  it("grows the bottom dock for a launch's minimum rows once the person moves its tab there from a side dock", async () => {
    const release: () => void = TerminalDockGrowths.ask("s1", 30);
    try {
      const host: PaneHost<TerminalSessionComponent> = createSession();
      dock(host, DockSide.Right);
      await host.attachedAsync();
      await vi.waitFor(() => expect(PaneHost.lastSize(host.runtime)).not.toBe(""), SOON);
      const beside: number = host.runtime.context.grownDocks.length;

      dock(host, DockSide.Bottom);

      await vi.waitFor(() => expect(host.runtime.context.grownDocks).toHaveLength(1), SOON);
      expect([beside, host.runtime.context.grownDocks.map(([tab]) => tab), host.runtime.context.callsOf("viewDockOf")]).toEqual([0, ["terminal.session/s1"], [["terminal.session", "s1"]]]);
    }
    finally {
      release();
    }
  });

  it("grows no dock for a terminal no launch asked rows for", async () => {
    const host: PaneHost<TerminalSessionComponent> = createSession();

    await host.attachedAsync();
    await vi.waitFor(() => expect(PaneHost.lastSize(host.runtime)).not.toBe(""), SOON);

    expect(host.runtime.context.grownDocks).toEqual([]);
  });

  it("only detaches its terminal when its tab goes away without the person closing it, as on a reload or a move", async () => {
    const host: PaneHost<TerminalSessionComponent> = createSession();
    await host.attachedAsync();

    host.fixture.destroy();

    expect(host.runtime.context.sent(TerminalNames.detachMethod).map(t => TerminalPaneReference.fromJson(t).sessionId)).toEqual(["s1"]);
    expect(host.runtime.context.sent(TerminalNames.closeMethod)).toEqual([]);
  });

  it("starts an ended shell again in its own tab, once however often it is clicked", async () => {
    const host: PaneHost<TerminalSessionComponent> = createSession();
    host.runtime.addSession("s1", "pwsh", "C:\\work");
    host.runtime.exit = new TerminalExit(0, EndedBy.Exit);
    await host.attachedAsync();
    await vi.waitFor(() => expect(host.element.querySelector(".nol-terminal-pane-ended button")).not.toBeNull(), SOON);

    host.element.querySelector<HTMLButtonElement>(".nol-terminal-pane-ended button")?.click();
    host.element.querySelector<HTMLButtonElement>(".nol-terminal-pane-ended button")?.click();

    await vi.waitFor(() => expect(host.element.querySelector(".nol-terminal-pane-ended")).toBeNull(), SOON);
    expect(host.runtime.context.sent(TerminalNames.restartMethod)).toEqual([{ sessionId: "s1", size: { cols: expect.any(Number), rows: expect.any(Number) } }]);
    expect([host.runtime.context.opened, host.runtime.context.sent(TerminalNames.openMethod), host.runtime.attachCount]).toEqual([[], [], 1]);
  });

  it("opens a new tab when the runtime has forgotten its terminal", async () => {
    const host: PaneHost<TerminalSessionComponent> = createSession();
    host.runtime.exit = new TerminalExit(0, EndedBy.Exit);
    await host.attachedAsync();
    await vi.waitFor(() => expect(host.element.querySelector(".nol-terminal-pane-ended button")).not.toBeNull(), SOON);

    host.element.querySelector<HTMLButtonElement>(".nol-terminal-pane-ended button")?.click();

    await vi.waitFor(() => expect(host.runtime.context.opened.map(t => [t.name, t.instance, t.title, t.options])).toEqual([
      ["terminal.session", "opened-1", "Bash", { icon: "attach_money" }]
    ]), SOON);
    expect(host.runtime.context.sent(TerminalNames.restartMethod)).toEqual([]);
  });

  it("logs a restart the runtime refuses, and can be clicked again", async () => {
    const host: PaneHost<TerminalSessionComponent> = createSession();
    host.runtime.addSession("s1", "bash", "/work");
    host.runtime.exit = new TerminalExit(0, EndedBy.Exit);
    host.runtime.restartFailure = FakeRuntime.refusal("no shell found");
    await host.attachedAsync();
    await vi.waitFor(() => expect(host.element.querySelector(".nol-terminal-pane-ended button")).not.toBeNull(), SOON);

    host.element.querySelector<HTMLButtonElement>(".nol-terminal-pane-ended button")?.click();
    await vi.waitFor(() => expect(host.runtime.context.logs).toEqual(["The terminal could not start: no shell found"]), SOON);
    host.runtime.restartFailure = null;
    host.element.querySelector<HTMLButtonElement>(".nol-terminal-pane-ended button")?.click();

    await vi.waitFor(() => expect(host.element.querySelector(".nol-terminal-pane-ended")).toBeNull(), SOON);
    expect(host.runtime.context.sent(TerminalNames.restartMethod)).toHaveLength(2);
  });

  it("doesn't offer to start an agent's ended shell again", async () => {
    const host: PaneHost<TerminalSessionComponent> = createSession();
    host.runtime.addSession("s1", "bash", "/work", new TerminalExit(0, EndedBy.Exit), true);
    host.runtime.exit = new TerminalExit(0, EndedBy.Exit);
    await host.attachedAsync();

    await vi.waitFor(() => expect([host.element.querySelector(".nol-terminal-pane-ended") === null, host.element.querySelector(".nol-terminal-pane-ended button")]).toEqual([false, null]), SOON);
    expect(host.element.querySelector(".nol-terminal-pane-ended")?.textContent).toContain("The shell exited with code 0.");
  });

  it("keeps its ended strip's Restart but offers none in the tab menu when it can't look its terminal up", async () => {
    const host: PaneHost<TerminalSessionComponent> = createSession();
    host.runtime.context.handlers.set(TerminalNames.sessionsMethod, async () => { throw FakeRuntime.refusal("the runtime is restarting"); });
    await host.attachedAsync();

    await vi.waitFor(() => expect([host.runtime.context.sent(TerminalNames.sessionsMethod).length, lastSize(host) === undefined]).toEqual([1, false]), SOON);
    await host.settleAsync();
    expect(tabMenuTarget()?.canRestart()).toBe(false);
    expect(host.runtime.context.logs).toEqual(["terminal.sessions failed: the runtime is restarting"]);
    host.runtime.exitSession("s1", 0);
    await vi.waitFor(() => expect(host.element.querySelector(".nol-terminal-pane-ended button")).not.toBeNull(), SOON);
    expect(tabMenuTarget()?.canRestart()).toBe(false);
  });

  it("offers Restart in the tab menu only once the lookup says its terminal isn't an agent's", async () => {
    const host: PaneHost<TerminalSessionComponent> = createSession();
    host.runtime.addSession("s1", "bash", "/work");
    let answer: () => void = () => undefined;
    const answered: Promise<void> = new Promise<void>(resolve => { answer = resolve; });
    host.runtime.context.handlers.set(TerminalNames.sessionsMethod, async () => {
      await answered;
      return new TerminalSessions(host.runtime.sessions).toJson();
    });
    await host.attachedAsync();
    await vi.waitFor(() => expect([host.runtime.context.sent(TerminalNames.sessionsMethod).length, lastSize(host) === undefined]).toEqual([1, false]), SOON);

    expect(tabMenuTarget()?.canRestart()).toBe(false);
    answer();

    await vi.waitFor(() => expect(tabMenuTarget()?.canRestart()).toBe(true), SOON);
  });

  it("offers Restart in the tab menu for its own terminal only once its pane has loaded its terminal", async () => {
    const loads: ((faces: FontFace[]) => void)[] = [];
    vi.spyOn(document.fonts, "load").mockImplementation(() => new Promise<FontFace[]>(resolve => loads.push(resolve)));
    const lookups = vi.spyOn(TerminalRuntimeClient.prototype, "isAgentTerminalAsync");
    try {
      const host: PaneHost<TerminalSessionComponent> = createSession();
      host.runtime.addSession("s1", "bash", "/work");
      host.fixture.detectChanges();
      await vi.waitFor(() => expect([lookups.mock.results.length, loads.length]).toEqual([1, 1]), SOON);
      expect(await lookups.mock.results[0]?.value).toBe(false);

      expect(tabMenuTarget()?.canRestart()).toBe(false);
      loads[0]?.([]);

      await vi.waitFor(() => expect(tabMenuTarget()?.canRestart()).toBe(true), SOON);
    }
    finally {
      vi.restoreAllMocks();
    }
  });

  it("starts its running shell again in place from the tab menu, at the pane's size, and gives the pane the focus", async () => {
    const host: PaneHost<TerminalSessionComponent> = createSession();
    host.runtime.addSession("s1", "bash", "/work");
    await host.attachedAsync();
    await vi.waitFor(() => expect(lastSize(host)).toBeDefined(), SOON);
    host.textarea.blur();

    expect(tabMenuTarget()?.canRestart()).toBe(true);
    await tabMenuTarget()?.restartAsync();

    expect(restartsOf(host).map(t => [t.sessionId, t.size])).toEqual([["s1", lastSize(host)]]);
    expect(document.activeElement).toBe(host.textarea);
    expect([host.runtime.context.opened, host.runtime.attachCount]).toEqual([[], 1]);
  });

  it("starts its ended shell again from the tab menu", async () => {
    const host: PaneHost<TerminalSessionComponent> = createSession();
    host.runtime.addSession("s1", "bash", "/work");
    host.runtime.exit = new TerminalExit(0, EndedBy.Exit);
    await host.attachedAsync();
    await vi.waitFor(() => expect(host.element.querySelector(".nol-terminal-pane-ended")).not.toBeNull(), SOON);

    await tabMenuTarget()?.restartAsync();

    await vi.waitFor(() => expect(host.element.querySelector(".nol-terminal-pane-ended")).toBeNull(), SOON);
    expect(host.runtime.context.sent(TerminalNames.restartMethod)).toEqual([{ sessionId: "s1", size: { cols: expect.any(Number), rows: expect.any(Number) } }]);
  });

  it("offers no Restart in the tab menu before its pane has loaded, for an agent's terminal, or once its tab is gone", async () => {
    const host: PaneHost<TerminalSessionComponent> = createSession();
    host.runtime.addSession("s1", "bash", "/work", null, true);
    host.fixture.detectChanges();
    expect(tabMenuTarget()?.canRestart() ?? false).toBe(false);
    await tabMenuTarget()?.restartAsync();

    await host.attachedAsync();
    await vi.waitFor(() => expect(host.runtime.context.sent(TerminalNames.sessionsMethod)).toHaveLength(1), SOON);
    await host.settleAsync();
    expect(tabMenuTarget()?.canRestart()).toBe(false);
    host.fixture.destroy();

    expect(tabMenuTarget()).toBeUndefined();
    expect(host.runtime.context.sent(TerminalNames.restartMethod)).toEqual([]);
  });

  it("shows its tab where it is from Toggle Terminal and gives its pane the focus, then from the pane gives the focus back and hides its dock", async () => {
    const host: PaneHost<TerminalSessionComponent> = createSession();
    host.runtime.addSession("s1", "bash", "/work");
    await host.attachedAsync();
    const field: HTMLInputElement = addField();
    field.focus();

    expect(await TerminalFocus.toggleAsync()).toBe(true);

    await vi.waitFor(() => expect(document.activeElement).toBe(host.textarea), SOON);
    expect(host.runtime.context.opened.map(t => [t.name, t.instance, t.title, t.options])).toEqual([["terminal.session", "s1", "Bash", { icon: "attach_money" }]]);
    expect(host.runtime.context.hiddenDocks).toEqual([]);
    expect(await TerminalFocus.toggleAsync()).toBe(true);
    expect(document.activeElement).toBe(field);
    expect(host.runtime.context.hiddenDocks).toEqual(["terminal.session/s1"]);
    host.fixture.destroy();
    expect(await TerminalFocus.toggleAsync()).toBe(false);
  });

  it("has its terminal's input as the first element a tab's choice focuses, while its shell runs and once it ended", async () => {
    const host: PaneHost<TerminalSessionComponent> = createSession();
    host.runtime.addSession("s1", "bash", "/work");
    await host.attachedAsync();
    const trap: FocusTrap = TestBed.inject(FocusTrapFactory).create(host.element, true);

    expect(trap.focusFirstTabbableElement()).toBe(true);
    expect(document.activeElement).toBe(host.textarea);
    host.textarea.blur();
    host.runtime.exitSession("s1", 1);
    await vi.waitFor(() => expect(host.element.querySelector(".nol-terminal-pane-ended button")).not.toBeNull(), SOON);
    expect(trap.focusFirstTabbableElement()).toBe(true);
    expect(document.activeElement).toBe(host.textarea);
    trap.destroy();
  });

  it("shows its tab and gives its pane the focus for a run that picks its terminal, and is passed by for another terminal", async () => {
    const host: PaneHost<TerminalSessionComponent> = createSession();
    host.runtime.addSession("s1", "bash", "/work");
    await host.attachedAsync();
    const field: HTMLInputElement = addField();
    field.focus();

    expect(await TerminalFocus.showAsync("s2")).toBe(false);
    expect(document.activeElement).toBe(field);
    expect(await TerminalFocus.showAsync("s1")).toBe(true);

    await vi.waitFor(() => expect(document.activeElement).toBe(host.textarea), SOON);
    expect(host.runtime.context.opened.map(t => [t.name, t.instance])).toEqual([["terminal.session", "s1"]]);
    host.fixture.destroy();
  });

  it("hands a malformed lookup answer to the window's error handler, rather than logging it as the runtime's refusal", async () => {
    const errors: ErrorRecorder = new ErrorRecorder();
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.context.handlers.set(TerminalNames.sessionsMethod, async () => ({ sessions: "none" }));
    const host: PaneHost<TerminalSessionComponent> = createSession(runtime, [{ provide: ErrorHandler, useValue: errors }]);

    await host.attachedAsync();

    await vi.waitFor(() => expect(errors.errors.map(t => t instanceof JsonException)).toEqual([true]), SOON);
    expect([host.runtime.context.logs, tabMenuTarget()?.canRestart()]).toEqual([[], false]);
  });

  it("hands a malformed answer while it starts its shell again to the window's error handler", async () => {
    const errors: ErrorRecorder = new ErrorRecorder();
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.addSession("s1", "bash", "/work");
    runtime.exit = new TerminalExit(0, EndedBy.Exit);
    let listings: number = 0;
    runtime.context.handlers.set(TerminalNames.sessionsMethod, async () => ++listings === 1 ? new TerminalSessions(runtime.sessions).toJson() : { sessions: "none" });
    const host: PaneHost<TerminalSessionComponent> = createSession(runtime, [{ provide: ErrorHandler, useValue: errors }]);
    await host.attachedAsync();
    await vi.waitFor(() => expect(host.element.querySelector(".nol-terminal-pane-ended button")).not.toBeNull(), SOON);

    host.element.querySelector<HTMLButtonElement>(".nol-terminal-pane-ended button")?.click();

    await vi.waitFor(() => expect(errors.errors.map(t => t instanceof JsonException)).toEqual([true]), SOON);
    expect([host.runtime.context.logs, restartsOf(host)]).toEqual([[], []]);
  });

  it("hands a lookup failure without the runtime's refusal code, such as a defect's TypeError, to the window's error handler, rather than logging it", async () => {
    const errors: ErrorRecorder = new ErrorRecorder();
    const runtime: FakeRuntime = new FakeRuntime();
    const defect: TypeError = new TypeError("sessions is undefined");
    runtime.context.handlers.set(TerminalNames.sessionsMethod, async () => { throw defect; });
    const host: PaneHost<TerminalSessionComponent> = createSession(runtime, [{ provide: ErrorHandler, useValue: errors }]);

    await host.attachedAsync();

    await vi.waitFor(() => expect(errors.errors).toEqual([defect]), SOON);
    expect(host.runtime.context.logs).toEqual([]);
  });

  it("hands a restart failure without the runtime's refusal code, such as a defect's TypeError, to the window's error handler, rather than logging it", async () => {
    const errors: ErrorRecorder = new ErrorRecorder();
    const runtime: FakeRuntime = new FakeRuntime();
    const defect: TypeError = new TypeError("size is undefined");
    runtime.addSession("s1", "bash", "/work");
    runtime.exit = new TerminalExit(0, EndedBy.Exit);
    runtime.restartFailure = defect;
    const host: PaneHost<TerminalSessionComponent> = createSession(runtime, [{ provide: ErrorHandler, useValue: errors }]);
    await host.attachedAsync();
    await vi.waitFor(() => expect(host.element.querySelector(".nol-terminal-pane-ended button")).not.toBeNull(), SOON);

    host.element.querySelector<HTMLButtonElement>(".nol-terminal-pane-ended button")?.click();

    await vi.waitFor(() => expect(errors.errors).toEqual([defect]), SOON);
    expect(host.runtime.context.logs).toEqual([]);
  });

  it("logs a shell that could not start again", async () => {
    const host: PaneHost<TerminalSessionComponent> = createSession();
    host.runtime.exit = new TerminalExit(0, EndedBy.Exit);
    host.runtime.openFailure = FakeRuntime.refusal("no shell found");
    await host.attachedAsync();
    await vi.waitFor(() => expect(host.element.querySelector(".nol-terminal-pane-ended button")).not.toBeNull(), SOON);

    host.element.querySelector<HTMLButtonElement>(".nol-terminal-pane-ended button")?.click();

    await vi.waitFor(() => expect(host.runtime.context.logs).toEqual(["The terminal could not start: no shell found"]), SOON);
    expect(host.runtime.context.opened).toEqual([]);
  });
});
