/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { signal, type Provider, type Type, type WritableSignal } from "@angular/core";
import { TestBed, type ComponentFixture } from "@angular/core/testing";
import { WindowPartTokens } from "@noldova/desktop.window";
import { TerminalInputParams, TerminalNames, TerminalResizeParams } from "@noldova/terminal.protocol";
import { ClipboardWriter } from "@noldova/ui.components.angular";
import { ClipboardWriterFixture } from "@noldova/ui.components.angular/testing";
import { DrawnWait } from "./drawn-wait.fixture.ts";
import { FakeRuntime } from "./fake-runtime.fixture.ts";

export class PaneHost<T> {
  public static readonly isMac: boolean = navigator.platform.startsWith("Mac");
  private readonly attached: Promise<void>;
  public readonly runtime: FakeRuntime;
  public readonly clipboard: ClipboardWriterFixture = new ClipboardWriterFixture();
  public readonly shown: WritableSignal<boolean>;
  public readonly fixture: ComponentFixture<T>;

  public constructor(component: Type<T>, isShown: boolean, inputs: Readonly<Record<string, unknown>> = {}, runtime: FakeRuntime = new FakeRuntime(),
    providers: readonly Provider[] = []) {
    this.runtime = runtime;
    this.shown = signal(isShown);
    this.attached = new Promise<void>(resolve => this.runtime.context.handlers.set(TerminalNames.visibilityMethod, async () => {
      resolve();
      return null;
    }));
    TestBed.configureTestingModule({
      providers: [
        { provide: WindowPartTokens.context, useValue: this.runtime.context },
        { provide: WindowPartTokens.shown, useValue: this.shown },
        { provide: ClipboardWriter, useValue: this.clipboard },
        ...providers
      ]
    });
    this.fixture = TestBed.createComponent(component);
    this.element.style.display = "block";
    this.element.style.inlineSize = "40rem";
    this.element.style.blockSize = "20rem";
    for (const [name, value] of Object.entries(inputs))
      this.fixture.componentRef.setInput(name, value);
  }

  public static fill(element: HTMLElement): void {
    const screen: HTMLElement | null = element.querySelector(".nol-terminal-pane-screen");
    if (Object.isNull(screen))
      throw new Error("The pane has no screen yet.");
    element.style.display = "flex";
    element.style.flexDirection = "column";
    screen.style.flex = "1 1 0";
    screen.style.minBlockSize = "0";
    screen.style.position = "relative";
    const bar: HTMLElement | null = screen.querySelector(".nol-terminal-pane-scrollbar");
    if (Object.isNull(bar))
      return;
    bar.style.position = "absolute";
    bar.style.insetBlock = "0";
    bar.style.insetInlineEnd = "0";
    bar.style.inlineSize = "1px";
    bar.style.overflowY = "auto";
  }

  public static hostOf<C>(fixture: ComponentFixture<C>): HTMLElement {
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The fixture's root isn't an element.");
    return element;
  }

  public static find<T extends Element>(root: ParentNode, selector: string, type: abstract new () => T): T {
    const found: Element | null = root.querySelector(selector);
    if (!(found instanceof type))
      throw new Error(`No ${type.name} matches ${selector}.`);
    return found;
  }

  public static async untilAsync(root: HTMLElement, selector: string): Promise<Element> {
    const found: Element | null = root.querySelector(selector);
    if (!Object.isNull(found))
      return found;
    let appear: (element: Element) => void = () => undefined;
    const added: Promise<Element> = new Promise<Element>(resolve => {
      appear = resolve;
    });
    const observer: MutationObserver = new MutationObserver(() => {
      const element: Element | null = root.querySelector(selector);
      if (!Object.isNull(element))
        appear(element);
    });
    observer.observe(root, { childList: true, subtree: true });
    try {
      return await PaneHost.boundAsync(added, `No ${selector} appeared in the pane`);
    }
    finally {
      observer.disconnect();
    }
  }

  public static async takeOutAsync(element: HTMLElement): Promise<void> {
    const screen: HTMLElement = PaneHost.find(element, ".nol-terminal-pane-screen", HTMLElement);
    let seen: (width: number) => void = () => undefined;
    const observer: ResizeObserver = new ResizeObserver(entries => {
      for (const entry of entries)
        seen(entry.contentRect.width);
    });
    try {
      await PaneHost.boundAsync(new Promise<void>(resolve => {
        seen = width => width > 0 ? resolve() : undefined;
        observer.observe(screen);
      }), "The pane's screen never had a width");
      const out: Promise<void> = new Promise<void>(resolve => {
        seen = width => width === 0 ? resolve() : undefined;
      });
      element.remove();
      await PaneHost.boundAsync(out, "The pane never saw its screen leave the page");
    }
    finally {
      observer.disconnect();
    }
  }

  public static lastSize(runtime: FakeRuntime): string {
    const sent: unknown = runtime.context.sent(TerminalNames.resizeMethod).at(-1);
    if (Object.isUndefined(sent))
      return "";
    const size: TerminalResizeParams["size"] = TerminalResizeParams.fromJson(sent).size;
    return `${size.columns}x${size.rows}`;
  }

  public get element(): HTMLElement {
    return PaneHost.hostOf(this.fixture);
  }

  public get textarea(): HTMLTextAreaElement {
    const textarea: HTMLTextAreaElement | null = this.element.querySelector("textarea");
    if (Object.isNull(textarea))
      throw new Error("The pane has no terminal yet.");
    return textarea;
  }

  public get text(): string {
    return this.element.querySelector(".xterm-rows")?.textContent ?? "";
  }

  public get screen(): HTMLElement {
    const screen: HTMLElement | null = this.element.querySelector(".xterm-screen");
    if (Object.isNull(screen))
      throw new Error("The pane has no terminal yet.");
    return screen;
  }

  public get inputs(): readonly string[] {
    return this.runtime.context.sent(TerminalNames.inputMethod).map(t => TerminalInputParams.fromJson(t).data);
  }

  public async startAsync(): Promise<void> {
    this.fixture.detectChanges();
    await this.fixture.whenStable();
    await PaneHost.untilAsync(this.element, "textarea");
  }

  public async attachedAsync(): Promise<void> {
    await this.startAsync();
    await PaneHost.boundAsync(this.attached, "The pane never sent terminal.visibility");
  }

  public async settleAsync(): Promise<void> {
    TestBed.tick();
    await this.fixture.whenStable();
  }

  public press(init: KeyboardEventInit): void {
    for (const type of ["keydown", "keyup"])
      this.textarea.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init }));
  }

  public pointAt(type: string, column: number, row: number, init: MouseEventInit = {}): void {
    const bounds: DOMRect = this.screen.getBoundingClientRect();
    const size: unknown = this.runtime.context.sent(TerminalNames.resizeMethod).at(-1);
    const columns: number = Object.isUndefined(size) ? 80 : TerminalResizeParams.fromJson(size).size.columns;
    const rows: number = this.element.querySelectorAll(".xterm-rows > div").length;
    const cellWidth: number = bounds.width / columns;
    const cellHeight: number = bounds.height / Math.max(rows, 1);
    this.screen.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: bounds.left + (column - 0.5) * cellWidth,
      clientY: bounds.top + (row - 0.5) * cellHeight,
      ...init
    }));
  }

  private static boundAsync<TResult>(work: Promise<TResult>, failure: string): Promise<TResult> {
    const signal: AbortSignal = AbortSignal.timeout(DrawnWait.milliseconds);
    const hung: Promise<never> = new Promise<never>((_resolve, reject) => signal.addEventListener("abort",
      () => reject(new Error(`${failure} within ${DrawnWait.milliseconds} ms.`)), { once: true }));
    return Promise.race([work, hung]);
  }
}
