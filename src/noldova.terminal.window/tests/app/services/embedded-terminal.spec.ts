/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApplicationRef, EnvironmentInjector, signal, type WritableSignal } from "@angular/core";
import { TestBed, type ComponentFixture } from "@angular/core/testing";
import { WindowPartTokens } from "@noldova/desktop.window";
import { TerminalNames, TerminalVisibilityParams } from "@noldova/terminal.protocol";
import { ClipboardWriter } from "@noldova/ui.components.angular";
import { ClipboardWriterFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { TerminalPaneComponent } from "../../../src/app/components/terminal-pane/terminal-pane.component.ts";
import { EmbeddedRowsRefusedException } from "../../../src/app/exceptions/embedded-rows-refused.exception.ts";
import { TerminalNotActiveException } from "../../../src/app/exceptions/terminal-not-active.exception.ts";
import { LaunchedTerminal } from "../../../src/app/models/launched-terminal.ts";
import { TerminalLaunch } from "../../../src/app/models/terminal-launch.ts";
import { EmbeddedTerminal } from "../../../src/app/services/embedded-terminal.ts";
import { SessionSizing } from "../../../src/app/services/session-sizing.ts";
import { TerminalLauncher } from "../../../src/app/services/terminal-launcher.ts";
import { TerminalPart } from "../../../src/app/services/terminal-part.ts";
import { Resources } from "../../../src/resources.ts";
import { FakeRuntime } from "../../fixtures/fake-runtime.fixture.ts";
import { PaneHost } from "../../fixtures/pane-host.fixture.ts";

const ROWS: number = 5;

describe("EmbeddedTerminal", () => {
  const opened: EmbeddedTerminal[] = [];
  const hosts: HTMLElement[] = [];
  let stopServing: () => void = () => undefined;
  let tabShown: WritableSignal<boolean> = signal<boolean>(true);

  beforeEach(() => {
    const getContext: HTMLCanvasElement["getContext"] = HTMLCanvasElement.prototype.getContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement, kind: string, options?: unknown): RenderingContext | null {
      return kind === "webgl2" ? null : getContext.call(this, kind, options);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const embedded of opened.splice(0))
      embedded.dispose();
    for (const host of hosts.splice(0))
      host.remove();
    stopServing();
  });

  function configure(): void {
    TestBed.configureTestingModule({ providers: [{ provide: ClipboardWriter, useValue: new ClipboardWriterFixture() }] });
  }

  function serve(): FakeRuntime {
    const runtime: FakeRuntime = new FakeRuntime();
    stopServing = TerminalPart.serve(runtime.context);
    tabShown = signal<boolean>(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: ClipboardWriter, useValue: new ClipboardWriterFixture() },
        { provide: WindowPartTokens.context, useValue: runtime.context },
        { provide: WindowPartTokens.shown, useValue: tabShown }
      ]
    });
    return runtime;
  }

  async function openTabAsync(): Promise<ComponentFixture<TerminalPaneComponent>> {
    const tab: ComponentFixture<TerminalPaneComponent> = TestBed.createComponent(TerminalPaneComponent);
    const element: HTMLElement = PaneHost.hostOf(tab);
    element.style.inlineSize = "50rem";
    element.style.blockSize = "20rem";
    tab.componentRef.setInput("sessionId", "s1");
    tab.detectChanges();
    PaneHost.fill(element);
    await tab.whenStable();
    await vi.waitFor(() => expect(element.querySelector("textarea")).not.toBeNull());
    return tab;
  }

  function sizeOf(pane: TerminalPaneComponent): string {
    return `${pane.size?.columns}x${pane.size?.rows}`;
  }

  function addHost(): HTMLElement {
    const host: HTMLElement = document.createElement("div");
    host.style.inlineSize = "40.25rem";
    document.body.append(host);
    hosts.push(host);
    return host;
  }

  function open(sessionId: string = "s1"): EmbeddedTerminal {
    const embedded: EmbeddedTerminal = EmbeddedTerminal.open(sessionId, TestBed.inject(EnvironmentInjector), ROWS);
    opened.push(embedded);
    addHost().append(embedded.element);
    return embedded;
  }

  async function openAsync(runtime: FakeRuntime): Promise<EmbeddedTerminal> {
    const attached: number = runtime.attachCount;
    const embedded: EmbeddedTerminal = open();
    await vi.waitFor(() => expect(runtime.attachCount).toBeGreaterThan(attached));
    await vi.waitFor(() => expect(screenOf(embedded).height).toBeGreaterThan(0));
    return embedded;
  }

  function rem(pixels: number): number {
    return pixels / Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  function textOf(embedded: EmbeddedTerminal): string {
    return embedded.element.querySelector(".xterm-rows")?.textContent ?? "";
  }

  function screenOf(embedded: EmbeddedTerminal): DOMRect {
    return embedded.element.querySelector(".xterm-screen")?.getBoundingClientRect() ?? new DOMRect();
  }

  function rowHeight(embedded: EmbeddedTerminal, rows: number = ROWS): number {
    return screenOf(embedded).height / rows;
  }

  async function declinedAsync(asked: MockInstance<typeof SessionSizing.isSizing>): Promise<void> {
    await vi.waitFor(() => expect(asked.mock.results.map(t => t.value)).toContain(false));
  }

  function visibilities(runtime: FakeRuntime): readonly boolean[] {
    return runtime.context.sent(TerminalNames.visibilityMethod).map(t => TerminalVisibilityParams.fromJson(t).isVisible);
  }

  async function expectRowsShownAsync(embedded: EmbeddedTerminal, rows: number, shellRows: number = ROWS): Promise<void> {
    await vi.waitFor(() => expect(embedded.rows()).toBe(rows));
    await vi.waitFor(() => expect(rowHeight(embedded, shellRows)).toBeGreaterThan(0));
    await vi.waitFor(() => expect(rem(embedded.element.getBoundingClientRect().height)).toBeCloseTo(rem(rows * rowHeight(embedded, shellRows)) + 0.75, 2));
  }

  it("refuses to open while Terminal's part isn't active in the window", () => {
    configure();

    expect(() => EmbeddedTerminal.open("s1", TestBed.inject(EnvironmentInjector), ROWS)).toThrow(TerminalNotActiveException);
  });

  it.each([0, 1.5, 1_001])("refuses %s rows", rows => {
    serve();

    expect(() => EmbeddedTerminal.open("s1", TestBed.inject(EnvironmentInjector), rows)).toThrow(EmbeddedRowsRefusedException);
    expect(() => EmbeddedTerminal.open("s1", TestBed.inject(EnvironmentInjector), rows)).toThrow(`An embedded terminal's rows must be a whole number from 1 to 1000, not ${rows}.`);
  });

  it.each([0, 1.5, 1_001])("refuses to set %s rows, and keeps its rows", async rows => {
    const runtime: FakeRuntime = serve();
    const embedded: EmbeddedTerminal = await openAsync(runtime);
    await vi.waitFor(() => expect(PaneHost.lastSize(runtime)).not.toBe(""));

    expect(() => embedded.setMaximumRows(rows)).toThrow(EmbeddedRowsRefusedException);
    expect(() => embedded.setMaximumRows(rows)).toThrow(`An embedded terminal's rows must be a whole number from 1 to 1000, not ${rows}.`);
    expect(PaneHost.lastSize(runtime)).toMatch(new RegExp(`x${ROWS}$`));
  });

  it("gives its shell fewer rows when the app lowers them below the rows drawn, shrinks, and scrolls inside", async () => {
    const runtime: FakeRuntime = serve();
    const embedded: EmbeddedTerminal = await openAsync(runtime);
    await vi.waitFor(() => expect(PaneHost.lastSize(runtime)).not.toBe(""));
    runtime.output("s1", 0, ["line 0", "line 1", "line 2", "line 3"].join("\r\n"));
    await expectRowsShownAsync(embedded, 4);

    embedded.setMaximumRows(2);

    await vi.waitFor(() => expect(PaneHost.lastSize(runtime)).toMatch(/x2$/));
    await expectRowsShownAsync(embedded, 2, 2);
    expect(textOf(embedded)).toContain("line 3");
    expect(textOf(embedded)).not.toContain("line 1");
  });

  it("gives its rows to the shell again when the app raises them", async () => {
    const runtime: FakeRuntime = serve();
    const embedded: EmbeddedTerminal = await openAsync(runtime);
    await vi.waitFor(() => expect(PaneHost.lastSize(runtime)).not.toBe(""));

    embedded.setMaximumRows(2);
    await vi.waitFor(() => expect(PaneHost.lastSize(runtime)).toMatch(/x2$/));
    embedded.setMaximumRows(8);

    await vi.waitFor(() => expect(PaneHost.lastSize(runtime)).toMatch(/x8$/));
  });

  it("lets a terminal tab the person types in keep the shell's size as it opens, and hands it back and forth on focus", async () => {
    const runtime: FakeRuntime = serve();
    const tab: ComponentFixture<TerminalPaneComponent> = await openTabAsync();
    const tabTextarea: HTMLTextAreaElement = PaneHost.find(PaneHost.hostOf(tab), "textarea", HTMLTextAreaElement);
    tabTextarea.focus();
    await vi.waitFor(() => expect(PaneHost.lastSize(runtime)).not.toBe(""));
    await vi.waitFor(() => expect(PaneHost.lastSize(runtime)).toBe(sizeOf(tab.componentInstance)));
    const tabSize: string = PaneHost.lastSize(runtime);
    const asked = vi.spyOn(SessionSizing, "isSizing");

    const embedded: EmbeddedTerminal = await openAsync(runtime);
    await declinedAsync(asked);
    const whileTyping: string = PaneHost.lastSize(runtime);
    embedded.focus();
    await vi.waitFor(() => expect(PaneHost.lastSize(runtime)).toMatch(new RegExp(`x${ROWS}$`)));
    await vi.waitFor(() => expect(sizeOf(tab.componentInstance)).toBe(PaneHost.lastSize(runtime)));
    const embeddedSize: string = PaneHost.lastSize(runtime);
    tabShown.set(false);
    TestBed.tick();
    await vi.waitFor(() => expect(visibilities(runtime).at(-1)).toBe(false));
    const whileHidden: string = PaneHost.lastSize(runtime);
    asked.mockClear();
    tabShown.set(true);
    TestBed.tick();
    await declinedAsync(asked);
    const shownUnfocused: string = PaneHost.lastSize(runtime);
    tabTextarea.focus();

    expect([whileTyping, whileHidden, shownUnfocused]).toEqual([tabSize, embeddedSize, embeddedSize]);
    await vi.waitFor(() => expect(PaneHost.lastSize(runtime)).toBe(tabSize));
    embedded.focus();
    await vi.waitFor(() => expect([PaneHost.lastSize(runtime), sizeOf(tab.componentInstance)]).toEqual([embeddedSize, embeddedSize]));
    opened.splice(0);
    embedded.dispose();

    await vi.waitFor(() => expect([PaneHost.lastSize(runtime), sizeOf(tab.componentInstance)]).toEqual([tabSize, tabSize]));
    tab.destroy();
  });

  it("leaves the shell's size with a terminal tab the person typed in, once the focus left it, as an embed opens unfocused", async () => {
    const runtime: FakeRuntime = serve();
    const tab: ComponentFixture<TerminalPaneComponent> = await openTabAsync();
    const tabTextarea: HTMLTextAreaElement = PaneHost.find(PaneHost.hostOf(tab), "textarea", HTMLTextAreaElement);
    tabTextarea.focus();
    for (const type of ["keydown", "keyup"])
      tabTextarea.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(runtime.context.sent(TerminalNames.inputMethod)).toHaveLength(1));
    await vi.waitFor(() => expect(PaneHost.lastSize(runtime)).toBe(sizeOf(tab.componentInstance)));
    const tabSize: string = PaneHost.lastSize(runtime);
    tabTextarea.blur();
    const isFocusOut: boolean = !PaneHost.hostOf(tab).contains(document.activeElement);
    const asked = vi.spyOn(SessionSizing, "isSizing");

    await openAsync(runtime);
    await declinedAsync(asked);

    expect([isFocusOut, PaneHost.lastSize(runtime), sizeOf(tab.componentInstance)]).toEqual([true, tabSize, tabSize]);
    tab.destroy();
  });

  it("draws with WebGL when the browser gives it a context, where the other tests read the DOM renderer's rows", async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockRestore();
    const runtime: FakeRuntime = serve();

    const embedded: EmbeddedTerminal = await openAsync(runtime);

    await vi.waitFor(() => expect(embedded.element.querySelectorAll(".xterm-screen canvas").length).toBeGreaterThan(0));
  });

  it("shows the session, gives its shell the rows asked for and the element's width, and is as tall as the rows drawn", async () => {
    const runtime: FakeRuntime = serve();
    runtime.snapshot = "one\r\ntwo";
    runtime.offset = runtime.snapshot.length;

    const embedded: EmbeddedTerminal = open();

    await vi.waitFor(() => expect(textOf(embedded)).toContain("two"));
    await vi.waitFor(() => expect(PaneHost.lastSize(runtime)).toMatch(new RegExp(`^\\d+x${ROWS}$`)));
    await expectRowsShownAsync(embedded, 2);
    expect([embedded.isFullScreen(), embedded.hasEnded()]).toEqual([false, false]);
  });

  it("grows up to the rows asked for, then scrolls inside", async () => {
    const runtime: FakeRuntime = serve();
    const embedded: EmbeddedTerminal = await openAsync(runtime);
    await vi.waitFor(() => expect(PaneHost.lastSize(runtime)).not.toBe(""));

    runtime.output("s1", 0, Array.from({ length: 12 }, (_, t) => `line ${t}`).join("\r\n"));

    await vi.waitFor(() => expect(textOf(embedded)).toContain("line 11"));
    await expectRowsShownAsync(embedded, ROWS);
    expect(textOf(embedded)).not.toContain("line 6");
  });

  it("gives a row's height without the element's inset, so its rows times it fall short of the element by that inset", async () => {
    const runtime: FakeRuntime = serve();
    const embedded: EmbeddedTerminal = await openAsync(runtime);
    runtime.output("s1", 0, "one\r\ntwo\r\nthree");

    await expectRowsShownAsync(embedded, 3);
    const height: number = embedded.rowHeight();

    expect([rem(height), rem(embedded.element.getBoundingClientRect().height - 3 * height)]).toEqual([
      expect.closeTo(rem(rowHeight(embedded)), 2), expect.closeTo(0.75, 2)]);
  });

  it("gives the new row height once the font size changes", async () => {
    const runtime: FakeRuntime = serve();
    const embedded: EmbeddedTerminal = await openAsync(runtime);
    await vi.waitFor(() => expect(embedded.rowHeight()).toBeGreaterThan(0));
    const before: number = embedded.rowHeight();

    runtime.context.changeSetting(Resources.fontSizeSetting, 21);

    await vi.waitFor(() => expect(embedded.rowHeight()).toBeGreaterThan(before));
    await vi.waitFor(() => expect(rem(embedded.rowHeight())).toBeCloseTo(rem(rowHeight(embedded)), 2));
  });

  it("shows all its rows while a full-screen program has the alternate screen, and its drawn rows once it leaves", async () => {
    const runtime: FakeRuntime = serve();
    const embedded: EmbeddedTerminal = await openAsync(runtime);
    await vi.waitFor(() => expect(PaneHost.lastSize(runtime)).not.toBe(""));

    const enter: string = "\u001b[?1049hfull";
    runtime.output("s1", 0, enter);
    await vi.waitFor(() => expect(embedded.isFullScreen()).toBe(true));
    await expectRowsShownAsync(embedded, ROWS);
    runtime.output("s1", enter.length, "\u001b[?1049l");

    await vi.waitFor(() => expect(embedded.isFullScreen()).toBe(false));
    await expectRowsShownAsync(embedded, 1);
  });

  it("moves to another host without the session reopening", async () => {
    const runtime: FakeRuntime = serve();
    runtime.snapshot = "moved";
    runtime.offset = runtime.snapshot.length;
    const embedded: EmbeddedTerminal = await openAsync(runtime);
    await vi.waitFor(() => expect(textOf(embedded)).toContain("moved"));

    addHost().append(embedded.element);
    runtime.output("s1", runtime.offset, " on");

    await vi.waitFor(() => expect(textOf(embedded)).toContain("moved on"));
    expect(runtime.attachCount).toBe(1);
  });

  it("takes the focus only when asked, even while its terminal still loads", async () => {
    serve();
    const field: HTMLInputElement = document.createElement("input");
    addHost().append(field);
    field.focus();
    const embedded: EmbeddedTerminal = open();
    await vi.waitFor(() => expect(embedded.element.querySelector("textarea")).not.toBeNull());
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();
    const before: Element | null = document.activeElement;
    const early: EmbeddedTerminal = open();
    early.focus();

    expect(before).toBe(field);
    await vi.waitFor(() => expect(document.activeElement).toBe(early.element.querySelector("textarea")));
    embedded.focus();
    expect(document.activeElement).toBe(embedded.element.querySelector("textarea"));
  });

  it("stops drawing while hidden, keeps its height out of the page, and draws again when shown", async () => {
    const runtime: FakeRuntime = serve();
    const embedded: EmbeddedTerminal = await openAsync(runtime);
    await expectRowsShownAsync(embedded, 1);
    const height: number = embedded.element.getBoundingClientRect().height;

    embedded.setShown(false);
    TestBed.tick();
    await PaneHost.takeOutAsync(embedded.element);
    addHost().append(embedded.element);
    const outHeight: number = embedded.element.getBoundingClientRect().height;
    embedded.setShown(true);
    TestBed.tick();

    expect(outHeight).toBeCloseTo(height, 1);
    await vi.waitFor(() => expect(visibilities(runtime)).toEqual([true, false, true]));
    await expectRowsShownAsync(embedded, 1);
  });

  it("shows a terminal launched without a tab, which ends when the app closes it", async () => {
    const runtime: FakeRuntime = serve();
    runtime.snapshot = "Sign in at the page that opened";
    runtime.offset = runtime.snapshot.length;
    runtime.context.handlers.set(TerminalNames.closeMethod, async t => {
      runtime.exitSession((t as { sessionId: string }).sessionId, null);
      return null;
    });
    const launched: LaunchedTerminal = await TerminalLauncher.openAsync(runtime.context, new TerminalLaunch(null, {}, null, null, "agent login", false));

    const embedded: EmbeddedTerminal = open(launched.sessionId);
    await vi.waitFor(() => expect(textOf(embedded)).toContain("Sign in at the page"));
    await launched.closeAsync();

    await vi.waitFor(() => expect(embedded.hasEnded()).toBe(true));
    expect([runtime.context.opened, runtime.context.closed]).toEqual([[], []]);
  });

  it("tells when the session's shell ended, and offers no restart", async () => {
    const runtime: FakeRuntime = serve();
    const embedded: EmbeddedTerminal = await openAsync(runtime);
    await vi.waitFor(() => expect(runtime.attachCount).toBe(1));

    runtime.exitSession("s1", 0);

    await vi.waitFor(() => expect(embedded.hasEnded()).toBe(true));
    expect(embedded.element.querySelector("button")).toBeNull();
  });

  it("detaches from the session when disposed, without closing it, and removes its element", async () => {
    const runtime: FakeRuntime = serve();
    const embedded: EmbeddedTerminal = await openAsync(runtime);
    await vi.waitFor(() => expect(runtime.attachCount).toBe(1));

    opened.splice(0);
    embedded.dispose();

    expect([embedded.element.isConnected, runtime.context.sent(TerminalNames.detachMethod).length]).toEqual([false, 1]);
    expect(runtime.context.sent(TerminalNames.closeMethod)).toEqual([]);
  });
});
