/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Terminal, type IMarker, type ITheme } from "@xterm/xterm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommandSuggestion } from "../../../src/app/services/command-suggestion.ts";
import { Resources } from "../../../src/resources.ts";
import { SpecWait } from "../../fixtures/spec-wait.fixture.ts";

const GREY: string = "rgb(127, 127, 127)";

const useFakeTimers = (): void => void vi.useFakeTimers({ toNotFake: ["requestIdleCallback", "cancelIdleCallback"] });

describe("CommandSuggestion", () => {
  let host: HTMLElement;
  let terminal: Terminal;
  let suggestion: CommandSuggestion;

  const writeAsync = (data: string): Promise<void> => new Promise<void>(resolve => terminal.write(data, resolve));
  const writeFakedAsync = async (data: string): Promise<void> => {
    const written: Promise<void> = writeAsync(data);
    await vi.advanceTimersByTimeAsync(0);
    await written;
  };
  const keyDown = (key: string, init: KeyboardEventInit = {}): KeyboardEvent => new KeyboardEvent(Resources.keyDownEvent, { key, ...init });
  const rem = (pixels: number): number => pixels / Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const shownElement = (): HTMLElement | null => host.querySelector<HTMLElement>(`.${Resources.suggestionClass}`);

  async function restAsync(): Promise<string | null> {
    const rest: string | null = suggestion.take(keyDown("End"));
    if (!Object.isNull(rest)) {
      await writeAsync(`\u001b7${rest}`);
      await writeAsync("\u001b8\u001b[J");
    }
    return rest;
  }

  function open(columns: number, rows: number = 5, theme: ITheme = { brightBlack: "#7f7f7f" }): void {
    terminal = new Terminal({ cols: columns, rows, fontSize: 16, fontFamily: "monospace", allowProposedApi: true, theme });
    terminal.open(host);
    suggestion = new CommandSuggestion(terminal);
    suggestion.setCommands(["git status", "git stash", "ls -la", "echo one two three four five six"]);
  }

  async function promptAsync(prompt: string = "$ "): Promise<void> {
    await writeAsync(prompt);
    suggestion.startInput();
  }

  async function rightPromptAsync(column: number, text: string, back: number): Promise<void> {
    await writeAsync(`\u001b[${column}G`);
    suggestion.markRightPrompt();
    await writeAsync(`${text}\u001b[${back}G`);
  }

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    vi.useRealTimers();
    suggestion.dispose();
    terminal.dispose();
    host.remove();
  });

  it("shows the rest of the newest earlier command that starts with what was typed, and follows each key", async () => {
    open(40);
    await promptAsync();

    await writeAsync("git st");
    expect(await restAsync()).toBe("atus");
    await writeAsync("as");
    expect(await restAsync()).toBe("h");
    await writeAsync("\b \b");
    expect(await restAsync()).toBe("tus");
    await writeAsync("tus");
    expect(await restAsync()).toBeNull();
  });

  it("draws the rest in grey from the cursor's cell on the cursor's row, one cell a character", async () => {
    open(40);
    await writeAsync("first row\r\n");
    await promptAsync();
    await writeAsync("git st");

    await vi.waitFor(() => expect(shownElement()?.textContent).toBe("atus"), { timeout: SpecWait.milliseconds });
    const element: HTMLElement | null = shownElement();
    const screen: HTMLElement | null = host.querySelector<HTMLElement>(".xterm-screen");
    expect(element).not.toBeNull();
    expect(screen).not.toBeNull();
    if (Object.isNull(element) || Object.isNull(screen))
      return;
    const drawn: DOMRect = screen.getBoundingClientRect();
    const cellWidth: number = drawn.width / terminal.cols;
    const cellHeight: number = drawn.height / terminal.rows;
    expect(rem(Number.parseFloat(element.style.left))).toBeCloseTo(rem(8 * cellWidth), 2);
    expect(rem(Number.parseFloat(element.style.top))).toBeCloseTo(rem(cellHeight), 2);
    expect(rem(Number.parseFloat(element.style.width))).toBeCloseTo(rem(4 * cellWidth), 1);
    expect(rem(Number.parseFloat(element.style.height))).toBeCloseTo(rem(cellHeight), 2);
    expect([...element.children].map(t => t.textContent)).toEqual(["a", "t", "u", "s"]);
    expect(getComputedStyle(element).color).toBe(GREY);
  });

  it("leaves the text's color to a theme without bright black", async () => {
    open(40, 5, {});
    await promptAsync();

    await writeAsync("git st");

    await vi.waitFor(() => expect(shownElement()?.textContent).toBe("atus"), { timeout: SpecWait.milliseconds });
    expect(shownElement()?.style.color).toBe("");
  });

  it("cuts the rest at the row's end", async () => {
    open(20);
    await promptAsync();

    await writeAsync("echo one two");
    await vi.waitFor(() => expect(shownElement()?.textContent).toBe(" three"), { timeout: SpecWait.milliseconds });
    expect(await restAsync()).toBe(" three four five six");
  });

  it("draws nothing while the cursor waits past the row's last cell, and the rest once the next character wraps", async () => {
    open(10);
    await promptAsync();
    const decorate = vi.spyOn(terminal, "registerDecoration");

    await writeAsync("git stat");
    expect(terminal.buffer.active.cursorX).toBe(10);
    expect(decorate).not.toHaveBeenCalled();
    expect(await restAsync()).toBeNull();
    await writeAsync("u");
    expect(await restAsync()).toBe("s");
  });

  it("draws nothing and lets its row's marker go when xterm gives no decoration", async () => {
    open(40);
    await promptAsync();
    const markers: IMarker[] = [];
    const registerMarker = terminal.registerMarker.bind(terminal);
    vi.spyOn(terminal, "registerMarker").mockImplementation(offset => {
      const marker: IMarker = registerMarker(offset);
      markers.push(marker);
      return marker;
    });
    vi.spyOn(terminal, "registerDecoration").mockReturnValue(undefined);

    await writeAsync("git st");

    expect(await restAsync()).toBeNull();
    expect(markers.length).toBeGreaterThan(0);
    expect(markers.filter(t => !t.isDisposed)).toEqual([]);
  });

  it("reads a command the shell wrapped over rows, and shows nothing on a later line of a command over several lines", async () => {
    open(10);
    await promptAsync();

    await writeAsync("echo one two");
    expect(terminal.buffer.active.cursorY).toBe(1);
    expect(await restAsync()).toBe(" three four five six");
    await writeAsync("\r\n> echo");
    expect(await restAsync()).toBeNull();
  });

  it("shows nothing before the line starts, at an empty line, while the line goes on after the cursor, or once the shell left it", async () => {
    open(40);
    await writeAsync("$ git st");
    expect(await restAsync()).toBeNull();

    await writeAsync("\r\u001b[K");
    await promptAsync();
    expect(await restAsync()).toBeNull();
    await writeAsync("git st and more\u001b[9D");
    expect(await restAsync()).toBeNull();
    await writeAsync("\u001b[K");
    await vi.waitFor(() => expect(shownElement()?.textContent).toBe("atus"), { timeout: SpecWait.milliseconds });
    suggestion.endInput();
    expect(await restAsync()).toBeNull();
    await vi.waitFor(() => expect(shownElement()).toBeNull(), { timeout: SpecWait.milliseconds });
  });

  it("gives way to the shell's own suggestion drawn after the cursor, as PSReadLine's predictions, and shows the rest once the shell clears it", async () => {
    open(40);
    await promptAsync();
    await writeAsync("git st\u001b[90matus --short\u001b[39m\u001b[12D");
    expect(await restAsync()).toBeNull();
    expect(shownElement()).toBeNull();

    await writeAsync("\u001b[K");

    await vi.waitFor(() => expect(shownElement()?.textContent).toBe("atus"), { timeout: SpecWait.milliseconds });
  });

  it("shows the rest before the right prompt the shell marked, cut where it starts, and nothing while other text follows the cursor", async () => {
    open(20);
    await promptAsync();
    await rightPromptAsync(14, "~/work", 3);

    await writeAsync("git st");
    await vi.waitFor(() => expect(shownElement()?.textContent).toBe("atus"), { timeout: SpecWait.milliseconds });
    await writeAsync("\b\b\b\b\b\b      \u001b[3Gecho");
    await vi.waitFor(() => expect(shownElement()?.textContent).toBe(" one tw"), { timeout: SpecWait.milliseconds });
    await writeAsync("\b\b\b\b    \u001b[3G");
    await writeAsync(" bar\u001b[3Gg bar\u001b[4D");
    expect(await restAsync()).toBeNull();
  });

  it("takes the right prompt again from each redrawn prompt's mark, as after a redraw in place, a resize or a cleared screen", async () => {
    open(20);
    await promptAsync();
    await rightPromptAsync(14, "~/work", 3);
    await writeAsync("git st");

    await writeAsync("\r\u001b[K");
    await promptAsync();
    await rightPromptAsync(14, "~/work", 3);
    await writeAsync("git st");
    await vi.waitFor(() => expect(shownElement()?.textContent).toBe("atus"), { timeout: SpecWait.milliseconds });
    terminal.resize(24, 5);
    await writeAsync("\r\u001b[K");
    await promptAsync();
    await rightPromptAsync(18, "~/work", 3);
    await writeAsync("git st");
    await vi.waitFor(() => expect(shownElement()?.textContent).toBe("atus"), { timeout: SpecWait.milliseconds });
    await writeAsync("\u001b[2J\u001b[H");
    await promptAsync();
    await rightPromptAsync(18, "~/work", 3);
    await writeAsync("echo one");
    await vi.waitFor(() => expect(shownElement()?.textContent).toBe(" two th"), { timeout: SpecWait.milliseconds });
  });

  it("takes no right prompt from a mark before a line starts or on another row", async () => {
    open(20);
    suggestion.markRightPrompt();
    await promptAsync();
    await writeAsync("\r\n");
    await rightPromptAsync(14, "~/work", 1);
    await writeAsync("\u001b[A\u001b[3Ggit st");

    await writeAsync("\u001b[14G~/work\u001b[9G");
    expect(await restAsync()).toBeNull();
  });

  it("shows nothing while text follows on a row the line wraps to, and the rest once that row is blank", async () => {
    open(10);
    await promptAsync();
    await writeAsync("git status x");

    await writeAsync("\u001b[A\u001b[K");
    expect(await restAsync()).toBeNull();
    await writeAsync("\u001b[B\r    \u001b[A");
    await vi.waitFor(() => expect(shownElement()?.textContent).toBe("t stat"), { timeout: SpecWait.milliseconds });
    expect(suggestion.take(keyDown("End"))).toBe("t status");
  });

  it("shows nothing on the alternate screen, as in a full-screen program", async () => {
    open(40);
    await promptAsync();
    await writeAsync("git st");
    expect(await restAsync()).toBe("atus");

    await writeAsync("\u001b[?1049h");
    expect(await restAsync()).toBeNull();
    suggestion.startInputAt(0, 0, 30);
    await writeAsync("git st");
    expect(await restAsync()).toBeNull();
  });

  it("reads the line again from where a prompt that redraws itself in place starts it", async () => {
    open(40);
    await promptAsync();
    await writeAsync("git st");

    await writeAsync("\r\u001b[K");
    await promptAsync("main $ ");
    expect(await restAsync()).toBeNull();
    await writeAsync("ls");
    expect(await restAsync()).toBe(" -la");
  });

  it("starts the line where an attachment says, by rows above the cursor and a column", async () => {
    open(10);
    await writeAsync("$ echo one two");

    suggestion.startInputAt(1, 2);

    expect(await restAsync()).toBe(" three four five six");
  });

  it("takes the right prompt from an attachment, on the line's first row", async () => {
    open(20);
    await writeAsync("$ git st\u001b[14G~/work\u001b[9G");

    suggestion.startInputAt(0, 2);
    const unmarked: string | null = await restAsync();
    suggestion.startInputAt(0, 2, 13);

    expect([unmarked, await restAsync()]).toEqual([null, "atus"]);
  });

  it("puts a command started since first, once, and shows nothing while turned off, dropping its commands", async () => {
    open(40);
    await promptAsync();
    await writeAsync("git sta");
    expect(await restAsync()).toBe("tus");

    suggestion.remember("git stage");
    suggestion.remember("git stage");
    await vi.waitFor(() => expect(shownElement()?.textContent).toBe("ge"), { timeout: SpecWait.milliseconds });
    suggestion.enable(false);
    expect(await restAsync()).toBeNull();
    await vi.waitFor(() => expect(shownElement()).toBeNull(), { timeout: SpecWait.milliseconds });
    suggestion.enable(true);
    expect(await restAsync()).toBeNull();
    suggestion.remember("git stage");
    expect(await restAsync()).toBe("ge");
  });

  it("holds the rest back while echoes of text the person sent are still on their way, until the line shows all of it", async () => {
    open(40);
    await promptAsync();
    await writeAsync("g");
    await vi.waitFor(() => expect(shownElement()?.textContent).toBe("it status"), { timeout: SpecWait.milliseconds });

    terminal.input("i");
    terminal.input("t");
    await writeAsync("i");
    expect(shownElement()).toBeNull();
    expect(suggestion.take(keyDown("ArrowRight"))).toBeNull();
    suggestion.remember("git stage");
    expect(suggestion.take(keyDown("End"))).toBeNull();
    await writeAsync("t");

    expect(await restAsync()).toBe(" stage");
  });

  it("reads the line as the screen shows it, and as the shell will have it with the text sent since, but not other input", async () => {
    open(40);
    expect([suggestion.readTyped(), suggestion.readLine()]).toEqual([null, null]);
    await promptAsync();
    await writeAsync("ls --a");

    terminal.input("l");
    expect([suggestion.readTyped(), suggestion.readLine()]).toEqual(["ls --a", "ls --al"]);
    await writeAsync("l");
    expect([suggestion.readTyped(), suggestion.readLine()]).toEqual(["ls --al", "ls --al"]);
    terminal.input("\u007f");
    expect([suggestion.readTyped(), suggestion.readLine()]).toEqual(["ls --al", null]);
    suggestion.endInput();

    expect([suggestion.readTyped(), suggestion.readLine()]).toEqual([null, null]);
  });

  it("holds the rest back after a key the shell answers slowly, as Tab, until it answered and then nothing came for a moment", async () => {
    open(40);
    await promptAsync();
    await writeAsync("git st");
    useFakeTimers();

    terminal.input("\t");
    await vi.advanceTimersByTimeAsync(150);
    expect(suggestion.take(keyDown("ArrowRight"))).toBeNull();
    await writeFakedAsync("\u0007");
    await vi.advanceTimersByTimeAsync(99);
    expect(suggestion.take(keyDown("ArrowRight"))).toBeNull();
    await vi.advanceTimersByTimeAsync(1);

    expect(suggestion.take(keyDown("ArrowRight"))).toBe("atus");
  });

  it("holds the rest back after a key the shell doesn't answer until no input came for a second", async () => {
    open(40);
    await promptAsync();
    await writeAsync("git st");
    useFakeTimers();

    terminal.input("\u001b[D");
    await vi.advanceTimersByTimeAsync(999);
    expect(suggestion.take(keyDown("End"))).toBeNull();
    await vi.advanceTimersByTimeAsync(1);

    expect(suggestion.take(keyDown("End"))).toBe("atus");
  });

  it("holds the rest back past a second while the echo of text the person sent is still on its way", async () => {
    open(40);
    await promptAsync();
    await writeAsync("git st");
    useFakeTimers();

    terminal.input("a");
    await vi.advanceTimersByTimeAsync(1_500);
    expect(suggestion.take(keyDown("End"))).toBeNull();
    await writeFakedAsync("a");

    expect(suggestion.take(keyDown("End"))).toBe("tus");
  });

  it("holds the rest back after text the shell drew otherwise until nothing came for a moment", async () => {
    open(40);
    await promptAsync();
    await writeAsync("git st");
    useFakeTimers();

    terminal.input("u");
    await writeFakedAsync("a");
    await vi.advanceTimersByTimeAsync(99);
    expect(suggestion.take(keyDown("End"))).toBeNull();
    await vi.advanceTimersByTimeAsync(1);

    expect(suggestion.take(keyDown("End"))).toBe("tus");
  });

  it("gives the rest for → or End with no modifier, and nothing for another key, a modifier, a key up or with nothing shown", async () => {
    open(40);
    await promptAsync();
    await writeAsync("git st");

    expect(suggestion.take(keyDown("ArrowLeft"))).toBeNull();
    expect(suggestion.take(keyDown("ArrowRight", { shiftKey: true }))).toBeNull();
    expect(suggestion.take(keyDown("End", { ctrlKey: true }))).toBeNull();
    expect(suggestion.take(new KeyboardEvent("keyup", { key: "End" }))).toBeNull();
    expect(suggestion.take(keyDown("End"))).toBe("atus");
    expect(suggestion.take(keyDown("ArrowRight"))).toBeNull();
    await writeAsync("at");
    expect(suggestion.take(keyDown("ArrowRight"))).toBeNull();
    await writeAsync("us");
    await writeAsync("\b\b\b\b\b\b\u001b[K");
    expect(suggestion.take(keyDown("ArrowRight"))).toBe("status");
  });

  it("leaves the keys an input method composes with to it, and gives the rest once the composition ends", async () => {
    open(40);
    await promptAsync();
    await writeAsync("git st");
    const composing: readonly KeyboardEvent[] = [keyDown("ArrowRight", { isComposing: true }), keyDown("End", { isComposing: true }), keyDown("Process")];

    expect([composing.map(t => suggestion.take(t)), suggestion.take(keyDown("End"))]).toEqual([[null, null, null], "atus"]);
  });
});

describe("CommandSuggestion's fake timers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("advance past an idle callback that asks for another while it is the only timer, as xterm's idle tasks do", async () => {
    useFakeTimers();
    setTimeout(() => requestIdleCallback(() => requestIdleCallback(() => undefined)), 10);

    await expect(vi.advanceTimersByTimeAsync(10)).resolves.toBeDefined();
  });
});
