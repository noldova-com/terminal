/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EnvironmentInjector } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { TerminalCompletion, TerminalCompletionItem, TerminalCompletionKind } from "@noldova/terminal.protocol";
import { Terminal } from "@xterm/xterm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommandSuggestion } from "../../../src/app/services/command-suggestion.ts";
import { CompletionList } from "../../../src/app/services/completion-list.ts";
import { Resources } from "../../../src/resources.ts";
import { SpecWait } from "../../fixtures/spec-wait.fixture.ts";

const LIST_STYLE: string = `.${Resources.completionListClass} { position: absolute !important; display: block !important; width: 120px !important;
  max-height: 60px !important; padding: 0 !important; border: 0 !important; overflow-y: auto !important; }
.${Resources.completionClass} { display: block !important; height: 20px !important; min-height: 0 !important; padding: 0 !important; }`;

const ARIA_STATE: readonly string[] = ["aria-activedescendant", "aria-controls", "aria-expanded", "aria-autocomplete"];

describe("CompletionList", () => {
  const options: readonly TerminalCompletionItem[] = ["--all", "--almost-all", "--author", "--and", "--any"]
    .map(t => new TerminalCompletionItem(t, t, TerminalCompletionKind.Option));
  let host: HTMLElement;
  let style: HTMLStyleElement;
  let terminal: Terminal;
  let suggestion: CommandSuggestion;
  let list: CompletionList;
  let inputs: string[];
  let logs: string[];
  let asked: [string, number][];
  let answerAsync: (line: string) => Promise<TerminalCompletion>;

  const writeAsync = (data: string): Promise<void> => new Promise<void>(resolve => terminal.write(data, resolve));
  const writeFakedAsync = async (data: string): Promise<void> => {
    const written: Promise<void> = writeAsync(data);
    await vi.advanceTimersByTimeAsync(0);
    await written;
  };
  const key = (name: string, init: KeyboardEventInit = {}, type: string = Resources.keyDownEvent): KeyboardEvent =>
    new KeyboardEvent(type, { key: name, cancelable: true, ...init });
  const listElement = (): HTMLElement | null => host.querySelector<HTMLElement>(`.${Resources.completionListClass}`);
  const rows = (): HTMLElement[] => [...host.querySelectorAll<HTMLElement>(`.${Resources.completionClass}`)];
  const labels = (): string[] => rows().map(t => t.querySelector(`.${Resources.completionLabelClass}`)?.textContent ?? "");
  const active = (): string | undefined => rows().find(t => t.ariaSelected === "true")?.querySelector(`.${Resources.completionLabelClass}`)?.textContent ?? undefined;

  async function openAsync(rowCount: number = 5, isOpened: boolean = true): Promise<void> {
    terminal = new Terminal({ cols: 40, rows: rowCount, fontSize: 16, fontFamily: "monospace", allowProposedApi: true });
    if (isOpened)
      terminal.open(host);
    suggestion = new CommandSuggestion(terminal);
    list = new CompletionList(terminal, host, suggestion, t => logs.push(t), TestBed.inject(EnvironmentInjector));
    terminal.onData(t => inputs.push(t));
    list.setCompleter(async (line, cursor) => {
      asked.push([line, cursor]);
      return answerAsync(line);
    });
    await writeAsync("$ ");
    suggestion.startInput();
    await writeAsync("ls --a");
  }

  async function listAsync(): Promise<HTMLElement> {
    expect(list.take(key("Tab"))).toBe(true);
    await vi.waitFor(() => expect(listElement()).not.toBeNull(), { timeout: SpecWait.milliseconds });
    return listElement() ?? host;
  }

  beforeEach(() => {
    host = document.createElement("div");
    host.style.position = "relative";
    host.style.width = "400px";
    host.style.height = "200px";
    document.body.append(host);
    style = document.createElement("style");
    style.textContent = LIST_STYLE;
    document.head.append(style);
    inputs = [];
    logs = [];
    asked = [];
    answerAsync = async line => new TerminalCompletion(line.length - 3, options);
  });

  afterEach(() => {
    vi.useRealTimers();
    list.dispose();
    suggestion.dispose();
    terminal.dispose();
    host.remove();
    style.remove();
  });

  it("asks for Tab with no modifier at a marked prompt, with the line up to the cursor, and lists the choices that start with the word", async () => {
    await openAsync();
    const tab: KeyboardEvent = key("Tab");

    expect(list.take(tab)).toBe(true);

    expect(tab.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(labels()).toEqual(["--all", "--almost-all", "--author", "--and", "--any"]), { timeout: SpecWait.milliseconds });
    expect(asked).toEqual([["ls --a", 6]]);
    expect(active()).toBe("--all");
    expect([listElement()?.role, listElement()?.ariaLabel, ...ARIA_STATE.map(t => terminal.textarea?.getAttribute(t))])
      .toEqual(["listbox", "Completions", rows()[0]?.id, listElement()?.id, "true", "list"]);
    expect(rows()[0]?.id).toBe(`${listElement()?.id}-option-0`);
    expect(rows().map(t => [t.role, t.querySelector(`.${Resources.completionKindClass}`)?.textContent])).toEqual(Array(5).fill(["option", "Option"]));
  });

  it("leaves Tab to the shell with a modifier, outside a line, with the list turned off or before it has a completer, and asks once while a request waits", async () => {
    terminal = new Terminal({ cols: 40, rows: 5, allowProposedApi: true });
    terminal.open(host);
    suggestion = new CommandSuggestion(terminal);
    list = new CompletionList(terminal, host, suggestion, t => logs.push(t), TestBed.inject(EnvironmentInjector));
    await writeAsync("$ ");
    suggestion.startInput();
    expect(list.take(key("Tab"))).toBe(false);
    list.setCompleter(async (line, cursor) => {
      asked.push([line, cursor]);
      return new Promise<TerminalCompletion>(() => undefined);
    });
    suggestion.endInput();
    expect(list.take(key("Tab"))).toBe(false);
    suggestion.startInput();

    expect([list.take(key("Tab", { shiftKey: true })), list.take(key("Tab", { ctrlKey: true })), list.take(key("Tab", { altKey: true })),
      list.take(key("Tab", { metaKey: true })), list.take(key("a"))]).toEqual([false, false, false, false, false]);
    list.enable(false);
    expect(list.take(key("Tab"))).toBe(false);
    list.enable(true);
    expect(list.take(key("Tab", {}, "keyup"))).toBe(true);
    expect(asked).toEqual([]);
    expect([list.take(key("Tab")), list.take(key("Tab"))]).toEqual([true, true]);
    expect(asked).toEqual([["", 0]]);
  });

  it("leaves Tab to the shell for a line longer than a request takes", async () => {
    await openAsync();
    await writeAsync("x".repeat(4_091));

    expect(list.take(key("Tab"))).toBe(false);
    expect(asked).toEqual([]);
  });

  it("moves with ↑ and ↓, wrapping at either end and scrolling the active row into view, and inserts the rest of the active choice for Tab", async () => {
    await openAsync();
    const element: HTMLElement = await listAsync();

    expect(list.take(key("ArrowUp"))).toBe(true);
    TestBed.tick();
    expect(active()).toBe("--any");
    expect(element.scrollTop).toBe(40);
    expect(list.take(key("ArrowDown"))).toBe(true);
    TestBed.tick();
    expect([active(), element.scrollTop]).toEqual(["--all", 0]);
    expect(list.take(key("ArrowDown", {}, "keyup"))).toBe(true);
    expect(active()).toBe("--all");
    list.take(key("ArrowDown"));
    expect(terminal.textarea?.getAttribute("aria-activedescendant")).toBe(rows()[1]?.id);
    expect(list.take(key("Tab"))).toBe(true);

    expect(inputs).toEqual(["lmost-all"]);
    expect(listElement()).toBeNull();
    expect(terminal.textarea?.hasAttribute("aria-activedescendant")).toBe(false);
  });

  it("inserts nothing for a choice that is the whole word, and erases the word and types the choice for Enter when its case differs", async () => {
    answerAsync = async () => new TerminalCompletion(3, [new TerminalCompletionItem("--a", "--a", TerminalCompletionKind.Option),
      new TerminalCompletionItem("--All", "--All", TerminalCompletionKind.Option)]);
    await openAsync();
    await listAsync();

    expect(list.take(key("Enter"))).toBe(true);
    expect([inputs, listElement()]).toEqual([[], null]);
    await listAsync();
    list.take(key("ArrowDown"));
    list.take(key("Enter"));

    expect(inputs).toEqual(["\u007f\u007f\u007f--All"]);
  });

  it("inserts the choice clicked, and keeps the focus where it is", async () => {
    await openAsync();
    await listAsync();
    const down: MouseEvent = new MouseEvent("mousedown", { bubbles: true, cancelable: true });

    rows()[2]?.dispatchEvent(down);
    rows()[2]?.click();

    expect([down.defaultPrevented, inputs, listElement()]).toEqual([true, ["uthor"], null]);
  });

  it("inserts nothing while input other than text waits for its echo, and keeps the list", async () => {
    await openAsync();
    await listAsync();
    terminal.input("\u001b[D");

    expect(list.take(key("Tab"))).toBe(true);

    expect(inputs).toEqual(["\u001b[D"]);
    expect(listElement()).not.toBeNull();
  });

  it("narrows as the screen shows the word grow, keeping the active choice, and closes once none starts with it", async () => {
    await openAsync();
    await listAsync();
    list.take(key("ArrowUp"));

    await writeAsync("n");
    await vi.waitFor(() => expect([labels(), active()]).toEqual([["--and", "--any"], "--any"]), { timeout: SpecWait.milliseconds });
    await writeAsync("\b\u001b[Kl");
    await vi.waitFor(() => expect([labels(), active()]).toEqual([["--all", "--almost-all"], "--all"]), { timeout: SpecWait.milliseconds });
    await writeAsync("x");

    await vi.waitFor(() => expect(listElement()).toBeNull(), { timeout: SpecWait.milliseconds });
  });

  it("closes when the line no longer starts as it did, and when the shell leaves it", async () => {
    await openAsync();
    await listAsync();

    await writeAsync("\b\b\b\b");
    await vi.waitFor(() => expect(listElement()).toBeNull(), { timeout: SpecWait.milliseconds });
    await writeAsync("\u001b[K --a");
    await listAsync();
    suggestion.endInput();
    await writeAsync("\r\n");

    await vi.waitFor(() => expect(listElement()).toBeNull(), { timeout: SpecWait.milliseconds });
  });

  it("keeps the list for text and Backspace, which go to the shell, and closes it for any other key or with a modifier", async () => {
    await openAsync();
    await listAsync();

    expect([list.take(key("l")), list.take(key("L", { shiftKey: true })), list.take(key("Backspace")), list.take(key("ArrowLeft", {}, "keyup"))])
      .toEqual([false, false, false, false]);
    expect(listElement()).not.toBeNull();
    expect(list.take(key("Tab", { shiftKey: true }))).toBe(false);
    expect(listElement()).toBeNull();
    for (const init of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
      await listAsync();
      expect(list.take(key("l", init))).toBe(false);
      expect(listElement()).toBeNull();
    }
  });

  it("closes for Escape, sending nothing, and for a blur, a resize, a scroll, a new completer, turning off and its disposal", async () => {
    await openAsync();
    const closers: readonly (() => void | Promise<void>)[] = [
      () => void list.take(key("Escape")),
      () => void terminal.textarea?.dispatchEvent(new FocusEvent("blur")),
      () => terminal.resize(39, 5),
      () => writeAsync("\r\n".repeat(6)),
      () => list.setCompleter(async line => answerAsync(line)),
      () => list.enable(false)
    ];
    for (const close of closers) {
      list.enable(true);
      await writeAsync("\r\n$ ");
      suggestion.startInput();
      await writeAsync("ls --a");
      await listAsync();
      await close();
      await vi.waitFor(() => expect(listElement()).toBeNull(), { timeout: SpecWait.milliseconds });
      expect(ARIA_STATE.map(t => terminal.textarea?.getAttribute(t))).toEqual([null, null, null, null]);
    }
    list.enable(true);
    await listAsync();
    list.dispose();

    expect([listElement(), inputs]).toEqual([null, []]);
  });

  it("gives the shell its Tab when nothing can follow or the request fails, which it logs, and sends nothing after the runtime sent it", async () => {
    await openAsync();
    const answers: (() => Promise<TerminalCompletion>)[] = [
      async () => new TerminalCompletion(3, []),
      async () => {
        throw new Error("The runtime is gone.");
      },
      async () => new TerminalCompletion(6, [], true)
    ];
    answerAsync = () => (answers.shift() ?? (async () => new TerminalCompletion(6, [], true)))();
    vi.useFakeTimers({ toNotFake: ["requestIdleCallback", "cancelIdleCallback"] });

    list.take(key("Tab"));
    await vi.waitFor(() => expect(inputs).toEqual(["\t"]), { timeout: SpecWait.milliseconds });
    await writeFakedAsync("\u0007");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(suggestion.readLine()).toBe("ls --a");
    list.take(key("Tab"));
    await vi.waitFor(() => expect(inputs).toEqual(["\t", "\t"]), { timeout: SpecWait.milliseconds });
    await writeFakedAsync("\u0007");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(suggestion.readLine()).toBe("ls --a");
    list.take(key("Tab"));
    await vi.waitFor(() => expect(asked).toHaveLength(3), { timeout: SpecWait.milliseconds });
    await writeFakedAsync("");

    expect(logs).toEqual(["The terminal could not list completions, so it sent Tab to the shell: The runtime is gone."]);
    expect(inputs).toEqual(["\t", "\t"]);
    expect(listElement()).toBeNull();
  });

  it("ends a waiting request for a key that reaches the shell, so the next Tab asks for the line it made, and keeps it for a modifier or Tab", async () => {
    const releases: (() => void)[] = [];
    answerAsync = () => new Promise<TerminalCompletion>(resolve => releases.push(() => resolve(new TerminalCompletion(3, options))));
    await openAsync();

    list.take(key("Tab"));
    expect([list.take(key("Shift", { shiftKey: true })), list.take(key("Tab")), list.take(key("ArrowLeft", {}, "keyup"))]).toEqual([false, true, false]);
    expect(asked).toHaveLength(1);
    expect(list.take(key("l"))).toBe(false);
    await writeAsync("l");
    expect(list.take(key("Tab"))).toBe(true);
    releases.shift()?.();
    releases.shift()?.();

    await vi.waitFor(() => expect(labels()).toEqual(["--all", "--almost-all"]), { timeout: SpecWait.milliseconds });
    expect(asked).toEqual([["ls --a", 6], ["ls --al", 7]]);
    expect(inputs).toEqual([]);
  });

  it("leaves the keys an input method composes with to it, with the list open or not", async () => {
    await openAsync();
    const composing: readonly KeyboardEvent[] = [key("Tab", { isComposing: true }), key("Process")];

    expect(composing.map(t => list.take(t))).toEqual([false, false]);
    expect(asked).toEqual([]);
    await listAsync();
    const keys: readonly KeyboardEvent[] = [key("Enter", { isComposing: true }), key("ArrowDown", { isComposing: true }), key("Process")];

    expect(keys.map(t => list.take(t))).toEqual([false, false, false]);
    expect(keys.map(t => t.defaultPrevented)).toEqual([false, false, false]);
    expect([listElement() === null, active(), inputs]).toEqual([false, "--all", []]);
  });

  it("drops a reply that comes after the line changed, or after the list closed meanwhile", async () => {
    const releases: (() => void)[] = [];
    answerAsync = line => new Promise<TerminalCompletion>(resolve => releases.push(() => resolve(new TerminalCompletion(line.length - 3, options))));
    await openAsync();

    list.take(key("Tab"));
    terminal.input("l");
    releases.shift()?.();
    await writeAsync("l");
    await vi.waitFor(() => {
      list.take(key("Tab"));
      expect(asked).toHaveLength(2);
    }, { timeout: SpecWait.milliseconds });
    list.close();
    releases.shift()?.();
    await writeAsync("");

    expect([listElement(), inputs, asked]).toEqual([null, ["l"], [["ls --a", 6], ["ls --al", 7]]]);
  });

  it("opens under the word's first cell, above the cursor's row when it doesn't fit below and there is more room above, and inside the pane", async () => {
    await openAsync(10);
    const screen: DOMRect = host.querySelector(Resources.xtermScreenSelector)?.getBoundingClientRect() ?? new DOMRect();
    const box: DOMRect = host.getBoundingClientRect();
    const cellWidth: number = screen.width / 40;
    const cellHeight: number = screen.height / 10;

    let element: HTMLElement = await listAsync();
    expect(element.getBoundingClientRect().left - box.left).toBeCloseTo(screen.left - box.left + 5 * cellWidth, 1);
    expect(element.getBoundingClientRect().top - box.top).toBeCloseTo(screen.top - box.top + cellHeight, 1);
    list.close();
    await writeAsync(`${"\r\n".repeat(9)}$ `);
    suggestion.startInput();
    await writeAsync(`${" ".repeat(32)}--a`);
    element = await listAsync();

    expect(element.getBoundingClientRect().bottom - box.top).toBeCloseTo(screen.top - box.top + 9 * cellHeight, 1);
    expect(element.getBoundingClientRect().right - box.left).toBeLessThanOrEqual(box.width + 0.01);
  });

  it("opens below the cursor's row when it fits neither way and there is no more room above", async () => {
    host.style.height = "48px";
    await openAsync(2);
    const screen: DOMRect = host.querySelector(Resources.xtermScreenSelector)?.getBoundingClientRect() ?? new DOMRect();

    const element: HTMLElement = await listAsync();

    expect(element.getBoundingClientRect().top - host.getBoundingClientRect().top).toBeCloseTo(screen.top - host.getBoundingClientRect().top + screen.height / 2, 1);
  });

  it("works on a terminal that isn't open yet, which has no input or screen to place it by", async () => {
    await openAsync(5, false);

    await listAsync();
    list.take(key("ArrowDown"));
    list.take(key("Escape"));

    expect([listElement(), inputs]).toEqual([null, []]);
  });
});
