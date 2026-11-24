/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LiveAnnouncer } from "@angular/cdk/a11y";
import { ErrorHandler, type Provider } from "@angular/core";
import { TestBed, type ComponentFixture } from "@angular/core/testing";
import type { SettingEntry } from "@noldova/desktop.protocol";
import { LinkPlace, type IInAppBrowser, type ISelectionSource } from "@noldova/desktop.window";
import {
  EndedBy, Resources as ProtocolResources, TerminalCompletion, TerminalCompletionItem, TerminalCompletionKind, TerminalExit, TerminalInputEdge, TerminalInputMark, TerminalInputStart,
  TerminalLine, TerminalLineRange, TerminalMissingCommands, TerminalNames, TerminalPaneReference, TerminalResizeParams, TerminalShellKind, TerminalSize, TerminalTextRun,
  TerminalVisibilityParams, WindowsPty
} from "@noldova/terminal.protocol";
import { LinkGesture } from "@noldova/ui.components.angular";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { cdp } from "vitest/browser";

import { TerminalPaneComponent } from "../../../../src/app/components/terminal-pane/terminal-pane.component.ts";
import { CommandColoring } from "../../../../src/app/services/command-coloring.ts";
import { SessionSizing } from "../../../../src/app/services/session-sizing.ts";
import { TerminalFocus } from "../../../../src/app/services/terminal-focus.ts";
import { TerminalConnection } from "../../../../src/app/services/terminal-connection.ts";
import { TerminalPager } from "../../../../src/app/services/terminal-pager.ts";
import { Resources } from "../../../../src/resources.ts";
import { Contrast } from "../../../fixtures/contrast.fixture.ts";
import { ErrorRecorder } from "../../../fixtures/error-recorder.fixture.ts";
import { FakeRuntime } from "../../../fixtures/fake-runtime.fixture.ts";
import { PaneHost } from "../../../fixtures/pane-host.fixture.ts";
import { SpecWait } from "../../../fixtures/spec-wait.fixture.ts";

const COPY: KeyboardEventInit = PaneHost.isMac ? { key: "c", metaKey: true } : { key: "C", ctrlKey: true, shiftKey: true };
const OPEN: MouseEventInit = PaneHost.isMac ? { metaKey: true } : { ctrlKey: true };
const IN_APP_BROWSER: IInAppBrowser = { placeFor: () => LinkPlace.InApp, openAsync: async () => undefined };
const SYSTEM_ON_MODIFIED_BROWSER: IInAppBrowser = {
  placeFor: (_url: string, gesture: LinkGesture) => gesture === LinkGesture.Modified ? LinkPlace.System : LinkPlace.InApp,
  openAsync: async () => undefined
};

function createPane(isShown: boolean = false, runtime: FakeRuntime = new FakeRuntime(), providers: readonly Provider[] = []): PaneHost<TerminalPaneComponent> {
  return new PaneHost(TerminalPaneComponent, isShown, { sessionId: "s1" }, runtime, providers);
}

async function refontAsync(host: PaneHost<TerminalPaneComponent>, family: string): Promise<void> {
  document.documentElement.style.setProperty("--nol-font-mono", family);
  await vi.waitFor(() => expect(getComputedStyle(host.element.querySelector(".xterm-rows") ?? host.element).fontFamily).toBe(family), { timeout: SpecWait.milliseconds });
}

async function emulateAsync(query: string, name: string, value: string): Promise<void> {
  const media: MediaQueryList = matchMedia(query);
  if (media.matches)
    throw new Error(`${query} already matches here, so turning on ${name}: ${value} changes nothing; run the spec where it doesn't match.`);
  const changed: Promise<void> = new Promise<void>(resolve => {
    media.onchange = () => resolve();
  });
  await cdp().send("Emulation.setEmulatedMedia", { features: [{ name, value }] });
  await changed;
}

function sessionsOf(sent: readonly unknown[]): readonly string[] {
  return sent.map(t => TerminalPaneReference.fromJson(t).sessionId);
}

function rowsOf(host: PaneHost<TerminalPaneComponent>): number {
  return host.element.querySelectorAll(".xterm-rows > div").length;
}

function scrolled(host: PaneHost<TerminalPaneComponent>): readonly [number, number] {
  const bar: HTMLElement = PaneHost.find(host.element, ".nol-terminal-pane-scrollbar", HTMLElement);
  const range: HTMLElement = PaneHost.find(bar, ":scope > *", HTMLElement);
  const row: number = bar.clientHeight / rowsOf(host);
  return [Math.round(bar.scrollTop / row), Math.round(range.getBoundingClientRect().height / row)];
}

function pageUp(host: PaneHost<TerminalPaneComponent>, times: number): void {
  for (let index = 0; index < times; index++)
    host.press({ key: "PageUp", code: "PageUp", keyCode: 33, shiftKey: true });
}

function storeLines(host: PaneHost<TerminalPaneComponent>): void {
  host.runtime.snapshot = Array.from({ length: 40 }, (_t, index) => `row ${index + 1}`).join("\r\n");
  host.runtime.offset = host.runtime.snapshot.length;
  host.runtime.storedLines = Array.from({ length: 300 }, (_t, index) => `stored ${index}`).map(t => new TerminalLine(t, false, [new TerminalTextRun(t.length, -1, -1, 0)]));
  host.runtime.stored = new TerminalLineRange(0, 300);
}

async function pageStoredInAsync(host: PaneHost<TerminalPaneComponent>): Promise<void> {
  await vi.waitFor(() => expect(host.text).toContain("row 40"), { timeout: SpecWait.milliseconds });
  await vi.waitFor(() => expect(scrolled(host)).toEqual([40 - rowsOf(host), 40]), { timeout: SpecWait.milliseconds });
  host.runtime.size = TerminalResizeParams.fromJson(host.runtime.context.sent(TerminalNames.resizeMethod).at(-1) ?? null).size;
  const [bottom] = scrolled(host);
  pageUp(host, Math.ceil(bottom / (rowsOf(host) - 1)));
  await vi.waitFor(() => expect(scrolled(host)).toEqual([300, 340]), { timeout: SpecWait.milliseconds });
}

async function openTypedAsync(host: PaneHost<TerminalPaneComponent>): Promise<void> {
  host.runtime.commands = ["git status"];
  host.runtime.snapshot = "$ git st";
  host.runtime.offset = 8;
  host.runtime.input = new TerminalInputStart(0, 2);
  await host.attachedAsync();
  await vi.waitFor(() => expect(host.text).toContain("$ git st"), { timeout: SpecWait.milliseconds });
}

function addField(): HTMLInputElement {
  const field: HTMLInputElement = document.body.appendChild(document.createElement("input"));
  onTestFinished(() => field.remove());
  return field;
}

describe("TerminalPaneComponent", () => {
  afterEach(async () => {
    await cdp().send("Emulation.setEmulatedMedia", { features: [] });
    vi.restoreAllMocks();
    document.documentElement.style.removeProperty("--nol-text-terminal");
    document.documentElement.style.removeProperty("--nol-font-mono");
    document.documentElement.style.removeProperty("font-size");
  });

  it("shows the session's snapshot, then its output, and acknowledges what it drew", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.snapshot = "hello";
    host.runtime.offset = 5;

    await host.startAsync();
    await vi.waitFor(() => expect(host.text).toContain("hello"), { timeout: SpecWait.milliseconds });
    host.runtime.output("s1", 5, " world");

    await vi.waitFor(() => expect(host.text).toContain("hello world"), { timeout: SpecWait.milliseconds });
    await vi.waitFor(() => expect(host.runtime.context.sent(TerminalNames.ackMethod)).toEqual([{ sessionId: "s1", paneId: expect.any(String), offset: 11 }]),
      { timeout: SpecWait.milliseconds });
  });

  it("draws with WebGL and reports itself visible while shown, and gives both up while hidden", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane(true);
    host.runtime.windowsPty = new WindowsPty(19_045);

    await host.attachedAsync();
    await vi.waitFor(() => expect(host.element.querySelector(".xterm-screen canvas")).not.toBeNull(), { timeout: SpecWait.milliseconds });
    host.shown.set(false);
    await host.settleAsync();

    expect(host.element.querySelector(".xterm-screen canvas")).toBeNull();
    await vi.waitFor(() => expect(host.runtime.context.sent(TerminalNames.visibilityMethod).map(t => TerminalVisibilityParams.fromJson(t).isVisible)).toEqual([true, false]),
      { timeout: SpecWait.milliseconds });
  });

  it("draws with the DOM renderer and logs why when WebGL can't load", async () => {
    const getContext: HTMLCanvasElement["getContext"] = HTMLCanvasElement.prototype.getContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement, kind: string, options?: unknown): RenderingContext | null {
      return kind === "webgl2" ? null : getContext.call(this, kind, options);
    });
    const host: PaneHost<TerminalPaneComponent> = createPane(true);
    host.runtime.snapshot = "still drawn";

    await host.attachedAsync();

    await vi.waitFor(() => expect(host.text).toContain("still drawn"), { timeout: SpecWait.milliseconds });
    expect(host.runtime.context.logs.filter(t => t.startsWith("The terminal draws with the DOM renderer, since WebGL failed: "))).toHaveLength(1);
  });

  it("starts the shell at its own size from a pane hidden in a collapsed dock, and resizes it to the pane once the dock shows", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane(false);
    host.element.style.display = "none";

    await host.attachedAsync();
    await vi.waitFor(() => expect(PaneHost.lastSize(host.runtime)).toBe("80x24"), { timeout: SpecWait.milliseconds });
    host.element.style.display = "block";
    host.shown.set(true);
    await host.settleAsync();

    await vi.waitFor(() => expect(PaneHost.lastSize(host.runtime)).not.toBe("80x24"), { timeout: SpecWait.milliseconds });
    const size: TerminalSize | null = host.fixture.componentInstance.size;
    expect([PaneHost.lastSize(host.runtime), host.runtime.context.sent(TerminalNames.resizeMethod).length]).toEqual([`${size?.columns}x${size?.rows}`, 2]);
  });

  it("sends no size from a shown pane with no box yet, as in a minimized window, and fits the shell to the pane once the window shows", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane(true);
    host.element.style.display = "none";

    await host.attachedAsync();
    await host.settleAsync();
    const hidden: readonly unknown[] = [...host.runtime.context.sent(TerminalNames.resizeMethod)];
    host.element.style.display = "block";

    await vi.waitFor(() => expect(host.runtime.context.sent(TerminalNames.resizeMethod)).toHaveLength(1), { timeout: SpecWait.milliseconds });
    const size: TerminalSize | null = host.fixture.componentInstance.size;
    expect([hidden, PaneHost.lastSize(host.runtime)]).toEqual([[], `${size?.columns}x${size?.rows}`]);
    expect(PaneHost.lastSize(host.runtime)).not.toBe("80x24");
  });

  it("starts the shell at one row from a shown pane too small for one, and fits it to the pane as the window grows", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane(true);
    host.element.style.blockSize = "1px";
    host.fixture.detectChanges();
    PaneHost.fill(host.element);

    await host.attachedAsync();
    await vi.waitFor(() => expect(PaneHost.lastSize(host.runtime)).toMatch(/^\d+x1$/u), { timeout: SpecWait.milliseconds });
    host.element.style.blockSize = "20rem";

    await vi.waitFor(() => expect(PaneHost.lastSize(host.runtime)).not.toMatch(/x1$/u), { timeout: SpecWait.milliseconds });
    const size: TerminalSize | null = host.fixture.componentInstance.size;
    expect(PaneHost.lastSize(host.runtime)).toBe(`${size?.columns}x${size?.rows}`);
  });

  it("fits the shell to the pane", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane(true);

    await host.startAsync();

    await vi.waitFor(() => expect(host.runtime.context.sent(TerminalNames.resizeMethod).length).toBeGreaterThan(0), { timeout: SpecWait.milliseconds });
    expect(host.runtime.context.sent(TerminalNames.resizeMethod).at(-1)).not.toEqual({ sessionId: "s1", size: { cols: 80, rows: 24 } });
  });

  it("lets one pane size a session's shell in the window, the one focused last, and draws the other at its size", async () => {
    const wide: PaneHost<TerminalPaneComponent> = createPane(true);
    const sent = (): string => PaneHost.lastSize(wide.runtime);
    const drawn = (pane: TerminalPaneComponent): string => `${pane.size?.columns}x${pane.size?.rows}`;
    wide.fixture.detectChanges();
    PaneHost.fill(wide.element);
    await wide.startAsync();
    await vi.waitFor(() => expect(sent()).not.toBe(""), { timeout: SpecWait.milliseconds });
    const wideSize: string = sent();
    const narrow: ComponentFixture<TerminalPaneComponent> = TestBed.createComponent(TerminalPaneComponent);
    document.body.append(wide.element);
    const element: HTMLElement = PaneHost.hostOf(narrow);
    element.style.inlineSize = "20rem";
    element.style.blockSize = "10rem";
    narrow.componentRef.setInput("sessionId", "s1");
    narrow.detectChanges();
    PaneHost.fill(element);
    await narrow.whenStable();
    await vi.waitFor(() => expect(element.querySelector("textarea")).not.toBeNull(), { timeout: SpecWait.milliseconds });
    wide.textarea.blur();
    PaneHost.find(element, "textarea", HTMLTextAreaElement).focus();

    await vi.waitFor(() => expect([sent(), drawn(wide.fixture.componentInstance)]).toEqual([drawn(narrow.componentInstance), drawn(narrow.componentInstance)]),
      { timeout: SpecWait.milliseconds });
    const narrowSize: string = sent();
    expect(narrowSize).not.toBe(wideSize);
    wide.textarea.focus();
    await vi.waitFor(() => expect([sent(), drawn(narrow.componentInstance)]).toEqual([wideSize, wideSize]), { timeout: SpecWait.milliseconds });
    const resizes: number = wide.runtime.context.sent(TerminalNames.resizeMethod).length;
    const asked = vi.spyOn(SessionSizing, "isSizing");
    element.style.inlineSize = "15rem";
    await vi.waitFor(() => expect(asked.mock.results.map(t => t.value)).toContain(false), { timeout: SpecWait.milliseconds });
    expect(wide.runtime.context.sent(TerminalNames.resizeMethod)).toHaveLength(resizes);
    wide.fixture.destroy();

    await vi.waitFor(() => expect(narrow.componentInstance.size?.columns).toBeLessThan(Number(narrowSize.split("x")[0])), { timeout: SpecWait.milliseconds });
    expect(sent()).toBe(drawn(narrow.componentInstance));
    narrow.destroy();
  });

  it("gives the shell its keys and keeps the window's command keys", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    await host.attachedAsync();

    host.press({ key: "k", code: "KeyK", ctrlKey: !PaneHost.isMac, shiftKey: !PaneHost.isMac, metaKey: PaneHost.isMac });
    host.press({ key: "Enter", code: "Enter", keyCode: 13 });

    await vi.waitFor(() => expect(host.inputs).toEqual(["\r"]), { timeout: SpecWait.milliseconds });
  });

  it("leaves Toggle Terminal's and New Terminal's keys, Ctrl+` and Ctrl+Shift+`, to the window", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    await host.attachedAsync();
    const reached: KeyboardEvent[] = [];
    const listener = (event: KeyboardEvent): void => {
      if (event.code === "Backquote")
        reached.push(event);
    };
    document.addEventListener("keydown", listener);

    host.press({ key: "`", code: "Backquote", keyCode: 192, ctrlKey: true });
    host.press({ key: "~", code: "Backquote", keyCode: 192, ctrlKey: true, shiftKey: true });
    host.press({ key: "Enter", code: "Enter", keyCode: 13 });
    document.removeEventListener("keydown", listener);

    await vi.waitFor(() => expect(host.inputs).toEqual(["\r"]), { timeout: SpecWait.milliseconds });
    expect(reached.map(t => [t.key, t.defaultPrevented])).toEqual([["`", false], ["~", false]]);
  });

  it("marks its screen as keeping Ctrl keys, so the window reads Ctrl+Shift+key there as its Ctrl+key shortcut", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    await host.attachedAsync();

    expect(host.element.querySelector(".nol-terminal-pane-screen")?.hasAttribute("data-nol-keeps-ctrl-keys")).toBe(true);
  });

  it("leaves a key the person bound to one of the module's commands to the window, and gives the shell the window's other Ctrl keys, which never reach the window", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    await host.attachedAsync();
    host.runtime.context.answer("findWindowCommand", t => t.code === "KeyJ" ? "terminal.toggle" : t.code === "KeyK" ? "chats.find" : null);
    const reached: [string, boolean][] = [];
    const listener = (event: KeyboardEvent): void => void reached.push([event.key, event.defaultPrevented]);
    document.addEventListener("keydown", listener);

    host.press({ key: "j", code: "KeyJ", keyCode: 74, ctrlKey: true });
    host.press({ key: "k", code: "KeyK", keyCode: 75, ctrlKey: true });
    document.removeEventListener("keydown", listener);

    await vi.waitFor(() => expect(host.inputs).toEqual(["\u000b"]), { timeout: SpecWait.milliseconds });
    expect(reached).toEqual([["j", false]]);
  });

  it("sends what an input method composes once, when the composition ends", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    await host.attachedAsync();
    host.textarea.focus();

    await cdp().send("Input.imeSetComposition", { text: "にほん", selectionStart: 3, selectionEnd: 3 });
    await cdp().send("Input.imeSetComposition", { text: "日本", selectionStart: 2, selectionEnd: 2 });
    expect(host.inputs).toEqual([]);
    await cdp().send("Input.insertText", { text: "日本" });

    await vi.waitFor(() => expect(host.inputs).toEqual(["日本"]), { timeout: SpecWait.milliseconds });
  });

  it("gives the shell the program's mouse reports", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.snapshot = "\u001b[?1000h";
    await host.attachedAsync();
    await vi.waitFor(() => expect(host.element.querySelector(".xterm.enable-mouse-events")).not.toBeNull(), { timeout: SpecWait.milliseconds });

    host.pointAt("mousedown", 2, 1, { button: 0 });
    host.pointAt("mouseup", 2, 1, { button: 0 });

    await vi.waitFor(() => expect(host.inputs[0]).toMatch(/^\u001b\[M /u), { timeout: SpecWait.milliseconds });
  });

  it("copies the selection with the copy keys through Noldova Desktop's clipboard writer, and logs a write it refuses or that fails", async () => {
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.snapshot = "copy me";
    await host.startAsync();
    await vi.waitFor(() => expect(host.text).toContain("copy me"), { timeout: SpecWait.milliseconds });

    host.press(COPY);
    host.pointAt("mousedown", 2, 1, { detail: 3, button: 0 });
    host.pointAt("mouseup", 2, 1, { detail: 3, button: 0 });
    host.press(COPY);
    await vi.waitFor(() => expect(host.clipboard.texts).toEqual(["copy me"]), { timeout: SpecWait.milliseconds });
    host.clipboard.answer = async () => false;
    host.press(COPY);
    await vi.waitFor(() => expect(host.runtime.context.logs).toContain("Copying the selection failed: the clipboard refused the text."), { timeout: SpecWait.milliseconds });
    host.clipboard.answer = () => Promise.reject(new Error("The main process is gone."));
    host.press(COPY);

    await vi.waitFor(() => expect(host.runtime.context.logs).toContain("Copying the selection failed: The main process is gone."), { timeout: SpecWait.milliseconds });
    expect(host.clipboard.texts).toEqual(["copy me", "copy me", "copy me"]);
    expect(host.runtime.context.logs.some(t => t.includes("copy me"))).toBe(false);
    expect(writeText).not.toHaveBeenCalled();
    expect(host.inputs).toEqual([]);
  });

  it("gives the window's Copy the terminal's selection while the pane is open, and takes it back once the pane closes", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.snapshot = "copy me";
    await host.startAsync();
    await vi.waitFor(() => expect(host.text).toContain("copy me"), { timeout: SpecWait.milliseconds });
    const source: ISelectionSource | undefined = host.runtime.context.selectionSources.get(host.element);
    const unselected: readonly [boolean, string] | undefined = source === undefined ? undefined : [source.hasSelection(), source.readSelection()];

    host.pointAt("mousedown", 2, 1, { detail: 3, button: 0 });
    host.pointAt("mouseup", 2, 1, { detail: 3, button: 0 });
    const selected: readonly [boolean, string] | undefined = source === undefined ? undefined : [source.hasSelection(), source.readSelection()];
    host.fixture.destroy();

    expect(unselected).toEqual([false, ""]);
    expect(selected).toEqual([true, "copy me"]);
    expect(host.runtime.context.selectionSources.size).toBe(0);
  });

  it("logs a selection Noldova Desktop's clipboard refuses, such as one over its limit, as refused, without its text", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.snapshot = "y".repeat(4_000);
    host.clipboard.answer = async () => false;
    await host.startAsync();
    await vi.waitFor(() => expect(host.text).toContain("yyy"), { timeout: SpecWait.milliseconds });

    host.pointAt("mousedown", 2, 1, { detail: 3, button: 0 });
    host.pointAt("mouseup", 2, 1, { detail: 3, button: 0 });
    host.press(COPY);

    await vi.waitFor(() => expect(host.runtime.context.logs).toContain("Copying the selection failed: the clipboard refused the text."), { timeout: SpecWait.milliseconds });
    expect(host.clipboard.texts.map(t => t.length)).toEqual([4_000]);
    expect(host.runtime.context.logs.some(t => t.includes("yyy"))).toBe(false);
  });

  it("pastes without escapes, bracketed when the program asks for it", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.snapshot = "\u001b[?2004hready";
    await host.attachedAsync();
    await vi.waitFor(() => expect(host.text).toContain("ready"), { timeout: SpecWait.milliseconds });
    const data: DataTransfer = new DataTransfer();
    data.setData("text/plain", "echo hi\u001b[201~x");

    host.textarea.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }));
    host.textarea.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(host.inputs[0]).toBe("\u001b[200~echo hi[201~x\u001b[201~"), { timeout: SpecWait.milliseconds });
    expect(host.inputs).toEqual(["\u001b[200~echo hi[201~x\u001b[201~"]);
  });

  it("holds a paste made while it attaches, and the keys after it, until the snapshot's modes are back, then sends them in order, the paste bracketed as the program asked", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.snapshot = "ready\u001b[?2004h";
    host.runtime.holdAttaches();
    await host.startAsync();
    const paste = (text: string): void => {
      const data: DataTransfer = new DataTransfer();
      data.setData("text/plain", text);
      host.textarea.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }));
    };

    host.press({ key: "Enter", code: "Enter", keyCode: 13 });
    paste("echo a");
    host.press({ key: "Enter", code: "Enter", keyCode: 13 });
    paste("echo b");
    const held: readonly string[] = [...host.inputs];
    host.runtime.releaseAttaches();

    await vi.waitFor(() => expect(host.inputs).toEqual(["\r", "\u001b[200~echo a\u001b[201~", "\r", "\u001b[200~echo b\u001b[201~"]), { timeout: SpecWait.milliseconds });
    expect(held).toEqual(["\r"]);
    await vi.waitFor(() => expect(host.text).toContain("ready"), { timeout: SpecWait.milliseconds });
  });

  it("leaves status and attribute queries to the runtime", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    await host.attachedAsync();

    host.runtime.output("s1", 0, "\u001b[6n\u001b[?6n\u001b[c\u001b[>c\u001b[=c\u001b[4$p\u001b[?1$p\u001bP$qm\u001b\\ready");

    await vi.waitFor(() => expect(host.text).toContain("ready"), { timeout: SpecWait.milliseconds });
    expect(host.inputs).toEqual([]);
  });

  it("answers a color query once for a session in two panes, from the pane that sizes it, as the sizing moves", async () => {
    const wide: PaneHost<TerminalPaneComponent> = createPane(true);
    PaneHost.fill(wide.element);
    await wide.startAsync();
    const narrow: ComponentFixture<TerminalPaneComponent> = TestBed.createComponent(TerminalPaneComponent);
    document.body.append(wide.element);
    const element: HTMLElement = PaneHost.hostOf(narrow);
    narrow.componentRef.setInput("sessionId", "s1");
    narrow.detectChanges();
    PaneHost.fill(element);
    await narrow.whenStable();
    await vi.waitFor(() => expect(element.querySelector("textarea")).not.toBeNull(), { timeout: SpecWait.milliseconds });
    const answers = (): number => wide.inputs.filter(t => t.startsWith("\u001b]11;rgb:")).length;
    const shown = (text: string): string[] => [wide.text, element.querySelector(".xterm-rows")?.textContent ?? ""].filter(t => t.includes(text));

    wide.runtime.output("s1", 0, "\u001b]11;?\u0007one");
    await vi.waitFor(() => expect([shown("one").length, answers() >= 1]).toEqual([2, true]), { timeout: SpecWait.milliseconds });
    const first: number = answers();
    PaneHost.find(element, "textarea", HTMLTextAreaElement).focus();
    wide.runtime.output("s1", 10, "\u001b]11;?\u0007two");
    await vi.waitFor(() => expect([shown("two").length, answers() >= 2]).toEqual([2, true]), { timeout: SpecWait.milliseconds });
    const second: number = answers();
    wide.textarea.focus();
    wide.runtime.output("s1", 20, "\u001b]11;?\u0007three");
    await vi.waitFor(() => expect([shown("three").length, answers() >= 3]).toEqual([2, true]), { timeout: SpecWait.milliseconds });

    expect([first, second, answers()]).toEqual([1, 2, 3]);
    narrow.destroy();
  });

  it("shows a web link's target on hover and opens it on the open click only, as a Ctrl+click, never on a middle or right button with Ctrl", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.context.inAppBrowser = IN_APP_BROWSER;
    host.runtime.snapshot = "https://noldova.com/docs";
    await host.startAsync();
    await vi.waitFor(() => expect(host.text).toContain("noldova"), { timeout: SpecWait.milliseconds });
    await vi.waitFor(() => expect(PaneHost.lastSize(host.runtime)).not.toBe(""), { timeout: SpecWait.milliseconds });

    host.pointAt("mousemove", 3, 1);
    await vi.waitFor(() => expect(host.element.getAttribute("title")).toBe("https://noldova.com/docs"), { timeout: SpecWait.milliseconds });
    host.pointAt("mousedown", 3, 1, { button: 0 });
    host.pointAt("mouseup", 3, 1, { button: 0 });
    host.pointAt("mousedown", 3, 1, { button: 1, ...OPEN });
    host.pointAt("mouseup", 3, 1, { button: 1, ...OPEN });
    host.pointAt("mousedown", 3, 1, { button: 2, ...OPEN });
    host.pointAt("mouseup", 3, 1, { button: 2, ...OPEN });
    host.pointAt("mousedown", 3, 1, { button: 0, ...OPEN });
    host.pointAt("mouseup", 3, 1, { button: 0, ...OPEN });
    await vi.waitFor(() => expect(host.runtime.context.links).toEqual(["https://noldova.com/docs"]), { timeout: SpecWait.milliseconds });
    expect([host.runtime.context.linkGestures, host.runtime.context.linkPlaces]).toEqual([[LinkGesture.Modified], [LinkPlace.System]]);
    host.pointAt("mousemove", 60, 10);

    await vi.waitFor(() => expect(host.element.getAttribute("title")).toBeNull(), { timeout: SpecWait.milliseconds });
  });

  it("opens a clicked link in the app's browser when the person chose it, even where the window's Links settings send a Ctrl+click to the system", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.context.settings.set("terminal.linkClick", "InApp");
    host.runtime.context.inAppBrowser = SYSTEM_ON_MODIFIED_BROWSER;
    host.runtime.snapshot = "https://noldova.com/docs";
    await host.startAsync();
    await vi.waitFor(() => expect(host.text).toContain("noldova"), { timeout: SpecWait.milliseconds });
    await vi.waitFor(() => expect(PaneHost.lastSize(host.runtime)).not.toBe(""), { timeout: SpecWait.milliseconds });

    host.pointAt("mousemove", 3, 1);
    await vi.waitFor(() => expect(host.element.getAttribute("title")).toBe("https://noldova.com/docs"), { timeout: SpecWait.milliseconds });
    host.pointAt("mousedown", 3, 1, { button: 0, ...OPEN });
    host.pointAt("mouseup", 3, 1, { button: 0, ...OPEN });

    await vi.waitFor(() => expect(host.runtime.context.links).toEqual(["https://noldova.com/docs"]), { timeout: SpecWait.milliseconds });
    expect([host.runtime.context.linkGestures, host.runtime.context.linkPlaces]).toEqual([[LinkGesture.Modified], [LinkPlace.InApp]]);
  });

  it("opens an OSC 8 link only when its target is allowed, and logs a link the window can't open", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.snapshot = "\u001b]8;;https://a.example/\u0007alpha\u001b]8;;\u0007 \u001b]8;;file:///etc/passwd\u0007beta\u001b]8;;\u0007";
    host.runtime.context.linkFailure = new Error("no browser");
    host.runtime.context.inAppBrowser = IN_APP_BROWSER;
    await host.startAsync();
    await vi.waitFor(() => expect(host.text).toContain("alpha beta"), { timeout: SpecWait.milliseconds });
    await vi.waitFor(() => expect(PaneHost.lastSize(host.runtime)).not.toBe(""), { timeout: SpecWait.milliseconds });

    host.pointAt("mousemove", 2, 1);
    await vi.waitFor(() => expect(host.element.getAttribute("title")).toBe("https://a.example/"), { timeout: SpecWait.milliseconds });
    host.pointAt("mousedown", 2, 1, { button: 0, ...OPEN });
    host.pointAt("mouseup", 2, 1, { button: 0, ...OPEN });
    host.pointAt("mousemove", 8, 1);
    await vi.waitFor(() => expect(host.element.getAttribute("title")).toBe("file:///etc/passwd"), { timeout: SpecWait.milliseconds });
    host.pointAt("mousedown", 8, 1, { button: 0, ...OPEN });
    host.pointAt("mouseup", 8, 1, { button: 0, ...OPEN });
    host.pointAt("mousemove", 60, 10);

    await vi.waitFor(() => expect(host.runtime.context.logs).toContain("Opening the link failed: no browser"), { timeout: SpecWait.milliseconds });
    await vi.waitFor(() => expect(host.element.getAttribute("title")).toBeNull(), { timeout: SpecWait.milliseconds });
    expect([host.runtime.context.links, host.runtime.context.linkGestures, host.runtime.context.linkPlaces])
      .toEqual([["https://a.example/"], [LinkGesture.Modified], [LinkPlace.System]]);
  });

  it("draws a color too faint for its background at a contrast of at least 4.5", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.element.style.backgroundColor = "rgb(255, 255, 255)";
    host.runtime.snapshot = "\u001b[38;2;250;250;250mfaint\u001b[0m";
    host.runtime.offset = host.runtime.snapshot.length;

    await host.startAsync();
    await vi.waitFor(() => expect(host.text).toContain("faint"), { timeout: SpecWait.milliseconds });
    const faint: Element | undefined = [...host.element.querySelectorAll(".xterm-rows span")].find(t => t.textContent === "faint");

    expect(faint).not.toBeUndefined();
    expect(Contrast.of(getComputedStyle(faint ?? host.element).color, "rgb(255, 255, 255)")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps an ended shell's screen read-only with a strip that offers to restart it", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.snapshot = "last words";
    host.runtime.exit = new TerminalExit(2, EndedBy.Exit);
    const restarts: TerminalSize[] = [];
    host.fixture.componentInstance.restartRequested.subscribe(t => restarts.push(t));
    await host.startAsync();
    PaneHost.fill(host.element);
    await vi.waitFor(() => expect(host.element.querySelector(".nol-terminal-pane-ended")?.textContent).toContain("The shell exited with code 2."),
      { timeout: SpecWait.milliseconds });
    const resizes: number = host.runtime.context.sent(TerminalNames.resizeMethod).length;
    const rows: number = host.fixture.componentInstance.size?.rows ?? 0;

    host.press({ key: "Enter", code: "Enter", keyCode: 13 });
    host.element.style.blockSize = "10rem";
    await vi.waitFor(() => expect(host.fixture.componentInstance.size?.rows).toBeLessThan(rows), { timeout: SpecWait.milliseconds });
    host.element.querySelector<HTMLButtonElement>(".nol-terminal-pane-ended button")?.click();

    expect(host.element.querySelector(".nol-terminal-pane-ended button")?.textContent?.trim()).toBe("Restart");
    expect(host.element.querySelector(".nol-terminal-pane-ended button.nol-button-text")).not.toBeNull();
    expect(host.element.querySelector(".nol-terminal-pane-ended button.nol-button-secondary")).toBeNull();
    expect(restarts).toEqual([expect.any(TerminalSize)]);
    expect(host.inputs).toEqual([]);
    expect(host.runtime.context.sent(TerminalNames.resizeMethod)).toHaveLength(resizes);
    expect(host.text).toContain("last words");
  });

  it("takes typing again when its shell restarts, keeps its screen and gives the shell the size it took while ended", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.snapshot = "last words";
    host.runtime.exit = new TerminalExit(0, EndedBy.Exit);
    await host.startAsync();
    PaneHost.fill(host.element);
    await vi.waitFor(() => expect([host.element.querySelector(".nol-terminal-pane-ended") === null, host.text]).toEqual([false, expect.stringContaining("last words")]),
      { timeout: SpecWait.milliseconds });
    const resizes: number = host.runtime.context.sent(TerminalNames.resizeMethod).length;
    const rows: number = host.fixture.componentInstance.size?.rows ?? 0;
    host.element.style.blockSize = "10rem";
    await vi.waitFor(() => expect(host.fixture.componentInstance.size?.rows).toBeLessThan(rows), { timeout: SpecWait.milliseconds });
    expect(host.runtime.context.sent(TerminalNames.resizeMethod)).toHaveLength(resizes);

    host.runtime.restartSession("s1");
    await host.settleAsync();
    host.press({ key: "Enter", code: "Enter", keyCode: 13 });

    expect(host.element.querySelector(".nol-terminal-pane-ended")).toBeNull();
    expect(host.inputs).toEqual(["\r"]);
    expect(host.runtime.context.sent(TerminalNames.resizeMethod).slice(resizes)).toEqual([{ sessionId: "s1", size: { cols: expect.any(Number), rows: expect.any(Number) } }]);
    expect([host.text, host.runtime.attachCount]).toEqual([expect.stringContaining("last words"), 1]);
  });

  async function focusAfterRestartAsync(field: HTMLElement | null): Promise<string> {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.exit = new TerminalExit(0, EndedBy.Exit);
    await host.startAsync();
    PaneHost.fill(host.element);
    await vi.waitFor(() => expect(host.element.querySelector(".nol-terminal-pane-ended button")).not.toBeNull(), { timeout: SpecWait.milliseconds });
    (field ?? host.element.querySelector<HTMLElement>(".nol-terminal-pane-ended button"))?.focus();
    const before: string | undefined = document.activeElement?.tagName;
    host.runtime.restartSession("s1");
    await host.settleAsync();
    const isOnShell: boolean = host.element.querySelector(".nol-terminal-pane-screen")?.contains(document.activeElement) === true;
    return `${before} to ${isOnShell ? "the shell" : document.activeElement?.tagName}`;
  }

  it("moves the focus from the ended strip's Restart to the shell when its shell restarts", async () => {
    expect(await focusAfterRestartAsync(null)).toBe("BUTTON to the shell");
  });

  it("leaves a focus outside the pane where it is when its shell restarts", async () => {
    const field: HTMLInputElement = document.createElement("input");
    document.body.append(field);
    onTestFinished(() => field.remove());

    expect(await focusAfterRestartAsync(field)).toBe("INPUT to INPUT");
  });

  it("asks to start again at the size it grew to while ended, so the restarted shell's line feeds scroll its whole old screen away", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.snapshot = "\r\n".repeat(3) + "last words";
    host.runtime.offset = host.runtime.snapshot.length;
    host.runtime.exit = new TerminalExit(0, EndedBy.Exit);
    const restarts: TerminalSize[] = [];
    host.fixture.componentInstance.restartRequested.subscribe(t => restarts.push(t));
    await host.startAsync();
    await vi.waitFor(() => expect(host.element.querySelector(".nol-terminal-pane-ended button")).not.toBeNull(), { timeout: SpecWait.milliseconds });
    host.element.querySelector<HTMLElement>(".nol-terminal-pane-screen")?.style.setProperty("block-size", "60rem");
    await vi.waitFor(() => expect(host.element.querySelectorAll(".xterm-rows > div").length).toBeGreaterThan(host.runtime.size.rows + 3), { timeout: SpecWait.milliseconds });

    host.element.querySelector<HTMLButtonElement>(".nol-terminal-pane-ended button")?.click();
    const size: TerminalSize = restarts[0] ?? host.runtime.size;
    host.runtime.restartSession("s1");
    host.runtime.output("s1", host.runtime.offset, "\r" + "\n".repeat(size.rows) + "\u001b[H" + "new prompt$ ");
    await host.settleAsync();

    expect(size.rows).toBeGreaterThan(host.runtime.size.rows + 3);
    await vi.waitFor(() => expect(host.text).toContain("new prompt$"), { timeout: SpecWait.milliseconds });
    expect(host.text).not.toContain("last words");
  });

  it("pages the session's stored lines in when Shift+PageUp scrolls above its scrollback, keeping the top line in place", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    storeLines(host);
    host.fixture.detectChanges();
    PaneHost.fill(host.element);
    await host.attachedAsync();

    await pageStoredInAsync(host);
    expect(host.runtime.context.sent(TerminalNames.linesMethod)).toEqual([{ sessionId: "s1", start: 0, limit: 300 }]);
    await vi.waitFor(() => expect(host.text).toMatch(/^row 1(?!\d)/u), { timeout: SpecWait.milliseconds });
    pageUp(host, Math.ceil(300 / (rowsOf(host) - 1)));

    await vi.waitFor(() => expect(host.text).toMatch(/^stored 0(?!\d)/u), { timeout: SpecWait.milliseconds });
    expect(scrolled(host)).toEqual([0, 340]);
    expect(host.runtime.context.sent(TerminalNames.linesMethod)).toHaveLength(1);
  });

  it("says the terminal was closed when its session is gone", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.attachFailure = FakeRuntime.gone("unknown session");

    await host.startAsync();

    await vi.waitFor(() => expect(host.element.querySelector(".nol-terminal-pane-ended")?.textContent).toContain("The terminal was closed."), { timeout: SpecWait.milliseconds });
  });

  it("passes the program's title on, cut to the tab's length", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    const titles: string[] = [];
    host.fixture.componentInstance.titleChanged.subscribe(t => titles.push(t));
    await host.startAsync();
    await vi.waitFor(() => expect(titles).toEqual([""]), { timeout: SpecWait.milliseconds });

    host.runtime.retitle("s1", "x".repeat(300));

    expect(titles[1]).toHaveLength(200);
  });

  it("passes the shell's working folder on, from the attach and as it changes", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    const folders: string[] = [];
    host.fixture.componentInstance.cwdChanged.subscribe(t => folders.push(t));
    host.runtime.cwd = "/work";
    await host.startAsync();
    await vi.waitFor(() => expect(folders).toEqual(["/work"]), { timeout: SpecWait.milliseconds });

    host.runtime.changeCwd("s1", "/work/src");

    expect(folders).toEqual(["/work", "/work/src"]);
  });

  it("moves to another session when its input changes, and clears the ended strip", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.exit = new TerminalExit(0, EndedBy.Exit);
    await host.startAsync();
    await vi.waitFor(() => expect(host.element.querySelector(".nol-terminal-pane-ended")).not.toBeNull(), { timeout: SpecWait.milliseconds });

    host.runtime.exit = null;
    host.fixture.componentRef.setInput("sessionId", "s2");
    await host.settleAsync();

    await vi.waitFor(() => expect(sessionsOf(host.runtime.context.sent(TerminalNames.attachMethod))).toEqual(["s1", "s2"]), { timeout: SpecWait.milliseconds });
    expect(sessionsOf(host.runtime.context.sent(TerminalNames.detachMethod))).toEqual(["s1"]);
    await vi.waitFor(() => expect(host.element.querySelector(".nol-terminal-pane-ended")).toBeNull(), { timeout: SpecWait.milliseconds });
  });

  it("suggests an earlier command's rest from a prompt's input mark, sends it to the shell for →, and stops at the line's end mark", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.commands = ["git status", "git stash"];
    await host.attachedAsync();

    host.runtime.output("s1", 0, "$ ", [new TerminalInputMark(2, TerminalInputEdge.Start)]);
    host.runtime.output("s1", 2, "git st");
    await vi.waitFor(() => expect(host.text).toContain("$ git st"), { timeout: SpecWait.milliseconds });
    host.press({ key: "ArrowRight", code: "ArrowRight", keyCode: 39 });

    expect(host.inputs.at(-1)).toBe("atus");
    host.runtime.output("s1", 8, "a", [new TerminalInputMark(9, TerminalInputEdge.End)]);
    await vi.waitFor(() => expect(host.text).toContain("$ git sta"), { timeout: SpecWait.milliseconds });
    host.press({ key: "End", code: "End", keyCode: 35 });
    await vi.waitFor(() => expect(host.inputs.at(-1)).toBe("\u001b[F"), { timeout: SpecWait.milliseconds });
  });

  it("follows no continuation prompt's mark while the pane shows stored pages instead of its live screen", async () => {
    const continued = vi.spyOn(CommandColoring.prototype, "continueInput");
    const ended = vi.spyOn(CommandColoring.prototype, "endInput");
    const host: PaneHost<TerminalPaneComponent> = createPane();
    await host.attachedAsync();
    host.runtime.output("s1", 0, "$ ", [new TerminalInputMark(2, TerminalInputEdge.Start)]);
    await vi.waitFor(() => expect(host.text).toContain("$"), { timeout: SpecWait.milliseconds });
    vi.spyOn(TerminalPager.prototype, "isLive", "get").mockReturnValue(false);
    const endings: number = ended.mock.calls.length;

    host.runtime.output("s1", 2, "echo 'a\r\n> ", [new TerminalInputMark(13, TerminalInputEdge.Continuation)]);

    await vi.waitFor(() => expect(host.runtime.context.sent(TerminalNames.ackMethod).at(-1)).toEqual({ sessionId: "s1", paneId: expect.any(String), offset: 13 }),
      { timeout: SpecWait.milliseconds });
    expect(continued).not.toHaveBeenCalled();
    expect(ended.mock.calls.length).toBe(endings);
  });

  it("goes on with the typed line's colors after a continuation prompt's mark, and suggests nothing there", async () => {
    const continued = vi.spyOn(CommandColoring.prototype, "continueInput");
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.commands = ["echo 'a b'"];
    await host.attachedAsync();

    host.runtime.output("s1", 0, "$ ", [new TerminalInputMark(2, TerminalInputEdge.Start)]);
    host.runtime.output("s1", 2, "echo 'a\r\n> ", [new TerminalInputMark(13, TerminalInputEdge.Continuation)]);
    host.runtime.output("s1", 13, "b");

    await vi.waitFor(() => expect(host.text).toContain("> b"), { timeout: SpecWait.milliseconds });
    expect(continued).toHaveBeenCalledTimes(1);
    expect(host.element.querySelector(`.${Resources.suggestionClass}`)).toBeNull();
  });

  it("suggests before a right prompt from the shell's mark of where it starts, and from the column an attach gives", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.commands = ["git status"];
    host.runtime.snapshot = "$ git st\u001b[14G~/work\u001b[9G";
    host.runtime.offset = 23;
    host.runtime.input = new TerminalInputStart(0, 2, 13);
    await host.attachedAsync();
    await vi.waitFor(() => expect(host.text).toContain("$ git st     ~/work"), { timeout: SpecWait.milliseconds });

    await vi.waitFor(() => expect(host.element.querySelector(`.${Resources.suggestionClass}`)?.textContent).toBe("atus"), { timeout: SpecWait.milliseconds });
    host.runtime.output("s1", 23, "\r\n$ ", [new TerminalInputMark(27, TerminalInputEdge.Start)]);
    host.runtime.output("s1", 27, "\u001b[14G", [new TerminalInputMark(32, TerminalInputEdge.RightPrompt)]);
    host.runtime.output("s1", 32, "~/work\u001b[3Ggit st");
    await vi.waitFor(() => expect(host.text.split("git st")).toHaveLength(3), { timeout: SpecWait.milliseconds });
    await vi.waitFor(() => expect(host.element.querySelector(`.${Resources.suggestionClass}`)?.textContent).toBe("atus"), { timeout: SpecWait.milliseconds });
    host.press({ key: "ArrowRight", code: "ArrowRight", keyCode: 39 });

    expect(host.inputs.at(-1)).toBe("atus");
  });

  it("starts the line where the attach says, suggests for End there, and puts a command the shell ran since first", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    await openTypedAsync(host);

    host.press({ key: "End", code: "End", keyCode: 35 });
    expect(host.inputs.at(-1)).toBe("atus");
    host.runtime.output("s1", 8, "atus");
    await vi.waitFor(() => expect(host.text).toContain("$ git status"), { timeout: SpecWait.milliseconds });
    host.runtime.addCommand("s1", "git status --short");
    host.press({ key: "End", code: "End", keyCode: 35 });

    expect(host.inputs.at(-1)).toBe(" --short");
  });

  it("takes no rest for → while echoes of input are still on their way, and suggests again once the line shows all of it", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    await openTypedAsync(host);
    const paste = (text: string): void => {
      const data: DataTransfer = new DataTransfer();
      data.setData("text/plain", text);
      host.textarea.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }));
    };

    paste("a");
    paste("t");
    host.runtime.output("s1", 8, "a");
    await vi.waitFor(() => expect(host.text).toContain("$ git sta"), { timeout: SpecWait.milliseconds });
    host.press({ key: "ArrowRight", code: "ArrowRight", keyCode: 39 });
    await vi.waitFor(() => expect(host.inputs.slice(-3)).toEqual(["a", "t", "\u001b[C"]), { timeout: SpecWait.milliseconds });
    host.runtime.output("s1", 9, "t");
    await vi.waitFor(() => expect(host.element.querySelector(`.${Resources.suggestionClass}`)?.textContent).toBe("us"), { timeout: SpecWait.milliseconds });
    host.press({ key: "End", code: "End", keyCode: 35 });

    expect(host.inputs.at(-1)).toBe("us");
  });

  it("suggests nothing while the Suggestions setting is off, and again once it is on", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.context.settings.set(ProtocolResources.suggestionsSetting, false);
    await openTypedAsync(host);

    host.press({ key: "ArrowRight", code: "ArrowRight", keyCode: 39 });
    await vi.waitFor(() => expect(host.inputs.at(-1)).toBe("\u001b[C"), { timeout: SpecWait.milliseconds });
    host.runtime.output("s1", 8, "\u0007");
    host.runtime.context.changeSetting(ProtocolResources.suggestionsSetting, true);
    await vi.waitFor(() => expect(host.element.querySelector(`.${Resources.suggestionClass}`)?.textContent).toBe("atus"), { timeout: SpecWait.milliseconds });
    host.press({ key: "ArrowRight", code: "ArrowRight", keyCode: 39 });

    expect(host.inputs.at(-1)).toBe("atus");
  });

  it("keeps a Suggestions change that came before its setting was read over the read's older value", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.context.answer("readSettingAsync", async name => {
      await Promise.resolve();
      runtime.context.changeSetting(ProtocolResources.suggestionsSetting, false);
      runtime.context.settings.set(ProtocolResources.suggestionsSetting, true);
      return runtime.context.entryOf(name);
    });
    const host: PaneHost<TerminalPaneComponent> = createPane(false, runtime);
    await openTypedAsync(host);

    host.press({ key: "ArrowRight", code: "ArrowRight", keyCode: 39 });

    await vi.waitFor(() => expect(host.inputs.at(-1)).toBe("\u001b[C"), { timeout: SpecWait.milliseconds });
  });

  it("turns typed command colors on and off with the Command colors setting", async () => {
    const enabled = vi.spyOn(CommandColoring.prototype, "enable");
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.context.settings.set(Resources.commandColorsSetting, true);
    await openTypedAsync(host);

    await vi.waitFor(() => expect(enabled.mock.calls.at(-1)).toEqual([true]), { timeout: SpecWait.milliseconds });
    host.runtime.context.changeSetting(Resources.commandColorsSetting, false);

    expect(enabled.mock.calls.at(-1)).toEqual([false]);
  });

  it("asks the runtime which typed command names its terminal's shell would find nowhere, while command colors are on", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.context.settings.set(Resources.commandColorsSetting, true);
    host.runtime.context.handlers.set(TerminalNames.findCommandsMethod, async () => new TerminalMissingCommands(["gti"]).toJson());
    host.runtime.shellKind = TerminalShellKind.Bash;
    await host.attachedAsync();

    host.runtime.output("s1", 0, "$ ", [new TerminalInputMark(2, TerminalInputEdge.Start)]);
    host.runtime.output("s1", 2, "gti");

    await vi.waitFor(() => expect(host.runtime.context.sent(TerminalNames.findCommandsMethod)).toEqual([{ sessionId: "s1", names: ["gti"] }]), { timeout: SpecWait.milliseconds });
  });

  it("logs a lookup of typed command names the runtime fails", async () => {
    const failure: Error = new Error("no lookup");
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.context.settings.set(Resources.commandColorsSetting, true);
    host.runtime.context.handlers.set(TerminalNames.findCommandsMethod, () => Promise.reject(failure));
    host.runtime.shellKind = TerminalShellKind.Bash;
    await host.attachedAsync();

    host.runtime.output("s1", 0, "$ ", [new TerminalInputMark(2, TerminalInputEdge.Start)]);
    host.runtime.output("s1", 2, "gti");

    await vi.waitFor(() => expect(host.runtime.context.logs).toContain(Resources.formatCommandLookupFailed(failure)), { timeout: SpecWait.milliseconds });
  });

  it("asks again about typed command names once it attaches again after a failed lookup", async () => {
    const failure: Error = new Error("no lookup");
    const host: PaneHost<TerminalPaneComponent> = createPane(true);
    host.runtime.context.settings.set(Resources.commandColorsSetting, true);
    host.runtime.context.handlers.set(TerminalNames.findCommandsMethod, () => Promise.reject(failure));
    host.runtime.shellKind = TerminalShellKind.Bash;
    await host.attachedAsync();
    host.runtime.output("s1", 0, "$ ", [new TerminalInputMark(2, TerminalInputEdge.Start)]);
    host.runtime.output("s1", 2, "gti");
    await vi.waitFor(() => expect(host.runtime.context.logs).toContain(Resources.formatCommandLookupFailed(failure)), { timeout: SpecWait.milliseconds });
    host.runtime.context.handlers.set(TerminalNames.findCommandsMethod, async () => new TerminalMissingCommands([]).toJson());
    host.runtime.snapshot = "$ gti";
    host.runtime.offset = 5;

    TerminalConnection.reattachAll();
    await vi.waitFor(() => expect(host.runtime.attachCount).toBe(2), { timeout: SpecWait.milliseconds });
    host.runtime.output("s1", 5, "\r\n$ ", [new TerminalInputMark(9, TerminalInputEdge.Start)]);
    host.runtime.output("s1", 9, "gtx");

    await vi.waitFor(() => expect(host.runtime.context.sent(TerminalNames.findCommandsMethod).at(-1)).toEqual({ sessionId: "s1", names: ["gtx"] }),
      { timeout: SpecWait.milliseconds });
  });

  it("keeps a Command colors change that came before its setting was read over the read's older value", async () => {
    const enabled = vi.spyOn(CommandColoring.prototype, "enable");
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.context.answer("readSettingAsync", async name => {
      await Promise.resolve();
      runtime.context.changeSetting(Resources.commandColorsSetting, true);
      runtime.context.settings.set(Resources.commandColorsSetting, false);
      return runtime.context.entryOf(name);
    });
    const host: PaneHost<TerminalPaneComponent> = createPane(false, runtime);
    await openTypedAsync(host);

    await vi.waitFor(() => expect(enabled.mock.calls.at(-1)).toEqual([true]), { timeout: SpecWait.milliseconds });
  });

  it("logs a Suggestions setting it can't read, and suggests", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.context.answer("readSettingAsync", () => Promise.reject(new Error("no settings")));
    const host: PaneHost<TerminalPaneComponent> = createPane(false, runtime);
    await openTypedAsync(host);

    await vi.waitFor(() => expect(host.runtime.context.logs).toContain(Resources.formatSuggestionsUnread(new Error("no settings"))), { timeout: SpecWait.milliseconds });
    host.press({ key: "End", code: "End", keyCode: 35 });

    expect(host.inputs.at(-1)).toBe("atus");
  });

  it("asks the runtime for the completions of its session for Tab, asking the shell too, and inserts the choice for Enter", async () => {
    const style: HTMLStyleElement = document.createElement("style");
    style.textContent = `.${Resources.completionListClass} { position: absolute; }`;
    document.head.append(style);
    onTestFinished(() => style.remove());
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.context.handlers.set(TerminalNames.completeMethod, async () => new TerminalCompletion(4, [
      new TerminalCompletionItem("stash", "stash", TerminalCompletionKind.Command),
      new TerminalCompletionItem("status", "status", TerminalCompletionKind.Command)
    ]).toJson());
    await openTypedAsync(host);

    host.press({ key: "Tab", code: "Tab", keyCode: 9 });
    await vi.waitFor(() => expect(host.element.querySelectorAll(`.${Resources.completionClass}`)).toHaveLength(2), { timeout: SpecWait.milliseconds });
    host.press({ key: "ArrowDown", code: "ArrowDown", keyCode: 40 });
    host.press({ key: "Enter", code: "Enter", keyCode: 13 });

    expect(host.runtime.context.sent(TerminalNames.completeMethod)).toEqual([{ sessionId: "s1", line: "git st", cursor: 6, asksShell: true }]);
    expect(host.inputs.at(-1)).toBe("atus");
    expect(host.element.querySelector(`.${Resources.completionListClass}`)).toBeNull();
  });

  it("logs a Complete with a list setting it can't read, and lists", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.context.answer("readSettingAsync", () => Promise.reject(new Error("no settings")));
    const host: PaneHost<TerminalPaneComponent> = createPane(false, runtime);
    await openTypedAsync(host);

    await vi.waitFor(() => expect(host.runtime.context.logs).toContain(Resources.formatCompletionListUnread(new Error("no settings"))), { timeout: SpecWait.milliseconds });
    host.press({ key: "Tab", code: "Tab", keyCode: 9 });

    await vi.waitFor(() => expect(host.runtime.context.sent(TerminalNames.completeMethod)).toHaveLength(1), { timeout: SpecWait.milliseconds });
  });

  it("gives Tab to the shell while Complete with a list is off, keeping a change that came before its setting was read over the read's older value", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.context.answer("readSettingAsync", async name => {
      await Promise.resolve();
      runtime.context.changeSetting(Resources.completionListSetting, false);
      runtime.context.settings.set(Resources.completionListSetting, true);
      return runtime.context.entryOf(name);
    });
    const host: PaneHost<TerminalPaneComponent> = createPane(false, runtime);
    await openTypedAsync(host);

    host.press({ key: "Tab", code: "Tab", keyCode: 9 });

    await vi.waitFor(() => expect(host.inputs.at(-1)).toBe("\t"), { timeout: SpecWait.milliseconds });
    expect(host.runtime.context.sent(TerminalNames.completeMethod)).toEqual([]);
  });

  it("draws at the Font size setting's default 13 pixels while it is unset, whatever the kit's terminal text size or the panel text size", async () => {
    document.documentElement.style.fontSize = "20px";
    document.documentElement.style.setProperty("--nol-text-terminal", "0.8125rem");
    const host: PaneHost<TerminalPaneComponent> = createPane();
    await host.startAsync();
    const size = (): string => getComputedStyle(host.element.querySelector(".xterm-rows") ?? host.element).fontSize;

    await vi.waitFor(() => expect(size()).toBe("13px"), { timeout: SpecWait.milliseconds });
    document.documentElement.style.setProperty("--nol-text-terminal", "21px");
    await refontAsync(host, "\"Courier New\", monospace");
    expect(size()).toBe("13px");
  });

  it("draws at the Font size setting's size while it is set, over the terminal text size, and at its default 13 pixels once it is reset", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.context.settings.set(Resources.fontSizeSetting, 17);
    await host.startAsync();
    const size = (): string => getComputedStyle(host.element.querySelector(".xterm-rows") ?? host.element).fontSize;

    await vi.waitFor(() => expect(size()).toBe("17px"), { timeout: SpecWait.milliseconds });
    host.runtime.context.changeSetting(Resources.fontSizeSetting, 19);
    await vi.waitFor(() => expect(size()).toBe("19px"), { timeout: SpecWait.milliseconds });
    document.documentElement.style.setProperty("--nol-text-terminal", "21px");
    await refontAsync(host, "\"Courier New\", monospace");
    expect(size()).toBe("19px");
    host.runtime.context.changeSetting(Resources.fontSizeSetting, undefined);
    await vi.waitFor(() => expect(size()).toBe("13px"), { timeout: SpecWait.milliseconds });
  });

  it("draws at its default 13 pixels when the Font size setting isn't a number", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.runtime.context.settings.set(Resources.fontSizeSetting, 17);
    await host.startAsync();
    const size = (): string => getComputedStyle(host.element.querySelector(".xterm-rows") ?? host.element).fontSize;
    await vi.waitFor(() => expect(size()).toBe("17px"), { timeout: SpecWait.milliseconds });

    host.runtime.context.changeSetting(Resources.fontSizeSetting, "large");

    await vi.waitFor(() => expect(size()).toBe("13px"), { timeout: SpecWait.milliseconds });
  });

  it("keeps a Font size change that came before its setting was read over the read's older size", async () => {
    const answers: (() => void)[] = [];
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.context.answer("readSettingAsync", name => new Promise<SettingEntry>(resolve => {
      answers.push(() => resolve(runtime.context.entryOf(name)));
    }));
    const reads = vi.spyOn(runtime.context, "readSettingAsync");
    const host: PaneHost<TerminalPaneComponent> = createPane(false, runtime);
    await host.startAsync();

    host.runtime.context.changeSetting(Resources.fontSizeSetting, 19);
    host.runtime.context.settings.set(Resources.fontSizeSetting, 17);
    for (const answer of answers)
      answer();
    await Promise.all(reads.mock.results.map(t => t.value));
    await refontAsync(host, "\"Courier New\", monospace");

    expect(getComputedStyle(host.element.querySelector(".xterm-rows") ?? host.element).fontSize).toBe("19px");
  });

  it("logs a Font size setting it can't read, and draws at its default 13 pixels", async () => {
    document.documentElement.style.setProperty("--nol-text-terminal", "21px");
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.context.answer("readSettingAsync", () => Promise.reject(new Error("no settings")));
    const host: PaneHost<TerminalPaneComponent> = createPane(false, runtime);
    await host.startAsync();

    await vi.waitFor(() => expect(host.runtime.context.logs).toContain(Resources.formatFontSizeUnread(new Error("no settings"))), { timeout: SpecWait.milliseconds });
    expect(getComputedStyle(host.element.querySelector(".xterm-rows") ?? host.element).fontSize).toBe("13px");
  });

  it("follows a code font that changed while its font was loading", async () => {
    const loads: ((faces: FontFace[]) => void)[] = [];
    vi.spyOn(document.fonts, "load").mockImplementation(() => new Promise<FontFace[]>(resolve => loads.push(resolve)));
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.fixture.detectChanges();
    await vi.waitFor(() => expect(loads).toHaveLength(1), { timeout: SpecWait.milliseconds });

    document.documentElement.style.setProperty("--nol-font-mono", "\"Courier New\", monospace");
    loads[0]?.([]);
    await host.startAsync();

    await vi.waitFor(() => expect(getComputedStyle(host.element.querySelector(".xterm-rows") ?? host.element).fontFamily).toBe("\"Courier New\", monospace"),
      { timeout: SpecWait.milliseconds });
  });

  it("takes the focus when it opens in view", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane(true);

    await host.startAsync();

    await vi.waitFor(() => expect(document.activeElement).toBe(host.textarea), { timeout: SpecWait.milliseconds });
  });

  it("leaves the focus where the person put it while its font was loading", async () => {
    const loads: ((faces: FontFace[]) => void)[] = [];
    vi.spyOn(document.fonts, "load").mockImplementation(() => new Promise<FontFace[]>(resolve => loads.push(resolve)));
    const field: HTMLInputElement = addField();
    const host: PaneHost<TerminalPaneComponent> = createPane(true);
    host.fixture.detectChanges();
    await vi.waitFor(() => expect(loads).toHaveLength(1), { timeout: SpecWait.milliseconds });

    field.focus();
    loads[0]?.([]);
    await host.startAsync();

    expect(document.activeElement).toBe(field);
  });

  it("leaves the focus in another field when the window opened its tab unasked, as for an agent's terminal, and takes it when asked", async () => {
    const field: HTMLInputElement = addField();
    field.focus();
    TerminalFocus.openUnasked("s1");
    const host: PaneHost<TerminalPaneComponent> = createPane(true);

    await host.startAsync();
    await host.settleAsync();

    expect(document.activeElement).toBe(field);
    expect(TerminalFocus.takeUnasked("s1")).toBe(false);
    host.fixture.componentInstance.focusWhenShown();
    expect(document.activeElement).toBe(host.textarea);
  });

  it("takes the focus when the focus fell back to the page while its font was loading", async () => {
    const loads: ((faces: FontFace[]) => void)[] = [];
    vi.spyOn(document.fonts, "load").mockImplementation(() => new Promise<FontFace[]>(resolve => loads.push(resolve)));
    const field: HTMLInputElement = addField();
    field.focus();
    const host: PaneHost<TerminalPaneComponent> = createPane(true);
    host.fixture.detectChanges();
    await vi.waitFor(() => expect(loads).toHaveLength(1), { timeout: SpecWait.milliseconds });

    field.remove();
    loads[0]?.([]);
    await host.startAsync();

    await vi.waitFor(() => expect(document.activeElement).toBe(host.textarea), { timeout: SpecWait.milliseconds });
  });

  it("takes the focus asked for while it is hidden once it shows, and at once while it shows", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    await host.attachedAsync();
    const field: HTMLInputElement = addField();
    field.focus();

    host.fixture.componentInstance.focusWhenShown();
    expect(document.activeElement).toBe(field);
    host.shown.set(true);
    await host.settleAsync();

    await vi.waitFor(() => expect(document.activeElement).toBe(host.textarea), { timeout: SpecWait.milliseconds });
    field.focus();
    host.fixture.componentInstance.focusWhenShown();
    expect(document.activeElement).toBe(host.textarea);
  });

  it("leaves the focus where it is when it shows after a focus asked for while hidden, as Restart from a background tab's menu asks", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    await host.attachedAsync();
    const field: HTMLInputElement = addField();
    field.focus();

    host.fixture.componentInstance.focus();
    expect(document.activeElement).toBe(field);
    host.shown.set(true);
    await host.settleAsync();

    expect(document.activeElement).toBe(field);
  });

  it("takes the focus asked for while its font was loading, even when the person moved the focus meanwhile", async () => {
    const loads: ((faces: FontFace[]) => void)[] = [];
    vi.spyOn(document.fonts, "load").mockImplementation(() => new Promise<FontFace[]>(resolve => loads.push(resolve)));
    const field: HTMLInputElement = addField();
    const host: PaneHost<TerminalPaneComponent> = createPane(true);
    host.fixture.detectChanges();
    await vi.waitFor(() => expect(loads).toHaveLength(1), { timeout: SpecWait.milliseconds });

    field.focus();
    host.fixture.componentInstance.focusWhenShown();
    loads[0]?.([]);
    await host.startAsync();

    await vi.waitFor(() => expect(document.activeElement).toBe(host.textarea), { timeout: SpecWait.milliseconds });
  });

  it("draws a solid blinking cursor while it has focus and a hollow one without it, and keeps it still under reduced motion", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    const cursor = (): string[] => [...host.element.querySelector(".xterm-cursor")?.classList ?? []].filter(t => t.startsWith("xterm-cursor-")).sort();
    await host.attachedAsync();
    host.runtime.output("s1", 0, "$ ");

    host.textarea.focus();
    await vi.waitFor(() => expect(cursor()).toEqual(["xterm-cursor-blink", "xterm-cursor-block"]), { timeout: SpecWait.milliseconds });
    await emulateAsync(Resources.reducedMotionQuery, "prefers-reduced-motion", "reduce");
    await vi.waitFor(() => expect(cursor()).toEqual(["xterm-cursor-block"]), { timeout: SpecWait.milliseconds });
    host.textarea.blur();
    await vi.waitFor(() => expect(cursor()).toEqual(["xterm-cursor-outline"]), { timeout: SpecWait.milliseconds });
  });

  it("reads its look again when it is shown after its Font size changed while it was hidden out of the page, and refits its shell", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane(true);
    const columns = (): number => {
      const sent: unknown = host.runtime.context.sent(TerminalNames.resizeMethod).at(-1);
      return sent === undefined ? 0 : TerminalResizeParams.fromJson(sent).size.columns;
    };
    await host.startAsync();
    await vi.waitFor(() => expect(columns()).toBeGreaterThan(0), { timeout: SpecWait.milliseconds });
    const before: number = columns();
    const parent: HTMLElement | null = host.element.parentElement;

    host.shown.set(false);
    await host.settleAsync();
    host.element.remove();
    host.runtime.context.changeSetting(Resources.fontSizeSetting, 21);
    parent?.append(host.element);
    host.shown.set(true);
    await host.settleAsync();

    await vi.waitFor(() => expect(columns()).toBeLessThan(before), { timeout: SpecWait.milliseconds });
  });

  it("draws on its host's background, and takes another host's when it moves there", async () => {
    const hosts: HTMLElement[] = [["rgb(255, 255, 255)", "rgb(0, 0, 0)"], ["rgb(0, 0, 0)", "rgb(255, 255, 255)"]].map(([background, text]) => {
      const element: HTMLElement = document.createElement("div");
      element.style.backgroundColor = background ?? "";
      element.style.color = text ?? "";
      document.body.append(element);
      return element;
    });
    const host: PaneHost<TerminalPaneComponent> = createPane();
    hosts[0]?.append(host.element);
    host.runtime.snapshot = "\u001b[38;2;200;200;200mpale\u001b[0m";
    host.runtime.offset = host.runtime.snapshot.length;
    const pale = (): string => {
      const cell: Element | undefined = [...host.element.querySelectorAll(".xterm-rows span")].find(t => t.textContent === "pale");
      return cell === undefined ? "" : getComputedStyle(cell).color;
    };

    await host.startAsync();
    await vi.waitFor(() => expect(Contrast.of(pale(), "rgb(255, 255, 255)")).toBeGreaterThanOrEqual(4.5), { timeout: SpecWait.milliseconds });
    await PaneHost.takeOutAsync(host.element);
    hosts[1]?.append(host.element);

    await vi.waitFor(() => expect(pale()).toBe("rgb(200, 200, 200)"), { timeout: SpecWait.milliseconds });
    host.fixture.destroy();
    for (const element of hosts)
      element.remove();
  });

  it.each([
    [Resources.forcedColorsQuery, "forced-colors", "active"],
    [Resources.darkPaletteQuery, "prefers-color-scheme", "dark"]
  ])("reads its colors again when %s turns on, and stops listening once it is gone", async (query, name, value) => {
    const added = vi.spyOn(MediaQueryList.prototype, "addEventListener");
    const removed = vi.spyOn(MediaQueryList.prototype, "removeEventListener");
    const listenersOf = (spy: typeof added | typeof removed): readonly unknown[][] => spy.mock.calls.filter((_t, index) => {
      const media: unknown = spy.mock.contexts[index];
      return media instanceof MediaQueryList && media.media === query;
    }).map(t => [t[0], t[1]]);
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.element.style.setProperty("forced-color-adjust", "none");
    await host.startAsync();
    const color = (): string => getComputedStyle(host.element.querySelector(".xterm-rows") ?? host.element).color;

    host.element.style.color = "rgb(1, 2, 3)";
    expect(color()).not.toBe("rgb(1, 2, 3)");
    await emulateAsync(query, name, value);

    await vi.waitFor(() => expect(color()).toBe("rgb(1, 2, 3)"), { timeout: SpecWait.milliseconds });
    host.fixture.destroy();
    expect(listenersOf(added).map(t => t[0])).toEqual([Resources.changeEvent]);
    expect(listenersOf(removed)).toEqual(listenersOf(added));
  });

  it("logs a code font that can't load and draws with what it has", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.element.style.setProperty("--nol-font-mono", ",");

    await host.startAsync();

    expect(host.runtime.context.logs[0]).toMatch(/^The terminal's font did not load, so it measures the font it has: /u);
  });

  it("does nothing when it is gone before its font loads", async () => {
    const loads: ((faces: FontFace[]) => void)[] = [];
    vi.spyOn(document.fonts, "load").mockImplementation(() => new Promise<FontFace[]>(resolve => loads.push(resolve)));
    const host: PaneHost<TerminalPaneComponent> = createPane();
    host.fixture.detectChanges();
    await vi.waitFor(() => expect(loads).toHaveLength(1), { timeout: SpecWait.milliseconds });
    const later: ComponentFixture<TerminalPaneComponent> = TestBed.createComponent(TerminalPaneComponent);
    later.componentRef.setInput("sessionId", "s2");
    later.detectChanges();
    await vi.waitFor(() => expect(loads).toHaveLength(2), { timeout: SpecWait.milliseconds });

    host.fixture.destroy();
    for (const load of loads)
      load([]);
    await PaneHost.untilAsync(PaneHost.hostOf(later), ".xterm");

    await vi.waitFor(() => expect(sessionsOf(host.runtime.context.sent(TerminalNames.attachMethod))).toEqual(["s2"]), { timeout: SpecWait.milliseconds });
    expect(host.element.querySelector(".xterm")).toBeNull();
    later.destroy();
  });

  it("announces its shell's end through the window's one live region, and keeps its strip out of the live regions", async () => {
    const host: PaneHost<TerminalPaneComponent> = createPane();
    const announced = vi.spyOn(TestBed.inject(LiveAnnouncer), "announce");
    host.runtime.exit = new TerminalExit(2, EndedBy.Exit);

    await host.startAsync();
    await vi.waitFor(() => expect(announced.mock.calls.map(t => t[0])).toEqual(["The shell exited with code 2."]), { timeout: SpecWait.milliseconds });
    await Promise.all(announced.mock.results.map(t => t.value));

    const strip: HTMLElement = PaneHost.find(host.element, ".nol-terminal-pane-ended", HTMLElement);
    expect(document.querySelector(".cdk-live-announcer-element")?.textContent).toBe("The shell exited with code 2.");
    expect([strip.getAttribute("role"), strip.getAttribute("aria-live"), strip.closest("[aria-live]")]).toEqual([null, null, null]);
  });

  it("hands a failure while it creates its terminal to the window's error handler", async () => {
    const errors: ErrorRecorder = new ErrorRecorder();
    const runtime: FakeRuntime = new FakeRuntime();
    const failure: Error = new Error("no selection sources");
    vi.spyOn(runtime.context, "registerSelectionSource").mockImplementation(() => {
      throw failure;
    });
    const host: PaneHost<TerminalPaneComponent> = createPane(false, runtime, [{ provide: ErrorHandler, useValue: errors }]);

    host.fixture.detectChanges();

    await vi.waitFor(() => expect(errors.errors).toEqual([failure]), { timeout: SpecWait.milliseconds });
    host.fixture.destroy();
  });
});
