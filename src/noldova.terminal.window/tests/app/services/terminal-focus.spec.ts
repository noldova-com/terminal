/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, describe, expect, it } from "vitest";

import type { ITerminalFocusTarget } from "../../../src/app/interfaces/i-terminal-focus-target.ts";
import { TerminalFocus } from "../../../src/app/services/terminal-focus.ts";

class FakeTerminal implements ITerminalFocusTarget {
  public readonly element: HTMLTextAreaElement = document.createElement("textarea");
  public canShow: boolean = true;
  public hiddenDocks: number = 0;
  public readonly remove: () => void;
  public readonly sessionId: string;

  public constructor(sessionId: string = "s1") {
    this.sessionId = sessionId;
    document.body.append(this.element);
    this.element.addEventListener("focusin", t => TerminalFocus.enter(this, t.relatedTarget));
    const remove: () => void = TerminalFocus.add(this);
    this.remove = () => {
      remove();
      this.element.remove();
    };
  }

  public contains(element: Element | null): boolean {
    return element === this.element;
  }

  public isFor(sessionId: string): boolean {
    return sessionId === this.sessionId;
  }

  public async showAsync(): Promise<boolean> {
    if (this.canShow)
      this.element.focus();
    return this.canShow;
  }

  public hideDock(): void {
    this.hiddenDocks += 1;
  }
}

const cleanups: (() => void)[] = [];

function terminal(sessionId?: string): FakeTerminal {
  const created: FakeTerminal = new FakeTerminal(sessionId);
  cleanups.push(created.remove);
  return created;
}

function field(): HTMLInputElement {
  const created: HTMLInputElement = document.createElement("input");
  document.body.append(created);
  cleanups.push(() => created.remove());
  return created;
}

describe("TerminalFocus", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0))
      cleanup();
  });

  it("shows and focuses the terminal the person used last, and from a terminal gives the focus back to where it came from and hides its dock", async () => {
    const first: FakeTerminal = terminal();
    const second: FakeTerminal = terminal();
    const name: HTMLInputElement = field();
    first.element.focus();
    second.element.focus();
    name.focus();

    expect(await TerminalFocus.toggleAsync()).toBe(true);
    expect(document.activeElement).toBe(second.element);
    expect([first.hiddenDocks, second.hiddenDocks]).toEqual([0, 0]);
    expect(await TerminalFocus.toggleAsync()).toBe(true);
    expect(document.activeElement).toBe(name);
    expect([first.hiddenDocks, second.hiddenDocks]).toEqual([0, 1]);
  });

  it("gives the focus back to where it was before it entered the first of several terminals", async () => {
    const first: FakeTerminal = terminal();
    const second: FakeTerminal = terminal();
    const name: HTMLInputElement = field();
    name.focus();
    first.element.focus();
    second.element.focus();

    await TerminalFocus.toggleAsync();

    expect(document.activeElement).toBe(name);
  });

  it("passes by a terminal that can't show, and answers false when none can", async () => {
    const first: FakeTerminal = terminal();
    const second: FakeTerminal = terminal();
    second.element.focus();
    field().focus();
    second.canShow = false;

    expect(await TerminalFocus.toggleAsync()).toBe(true);
    expect(document.activeElement).toBe(first.element);
    first.element.blur();
    first.canShow = false;
    expect(await TerminalFocus.toggleAsync()).toBe(false);
  });

  it("leaves the terminal when where the focus came from can't take it any more", async () => {
    const only: FakeTerminal = terminal();
    const name: HTMLInputElement = field();
    name.focus();
    only.element.focus();
    name.disabled = true;

    expect(await TerminalFocus.toggleAsync()).toBe(true);

    expect(document.activeElement).toBe(document.body);
  });

  it("leaves the terminal and hides its dock when the focus came into it from nowhere", async () => {
    const only: FakeTerminal = terminal();
    only.element.focus();

    expect(await TerminalFocus.toggleAsync()).toBe(true);

    expect([document.activeElement, only.hiddenDocks]).toEqual([document.body, 1]);
  });

  it("leaves the terminal when where the focus came from is gone, and forgets a terminal that is gone", async () => {
    const first: FakeTerminal = terminal();
    const second: FakeTerminal = terminal();
    const name: HTMLInputElement = field();
    first.element.focus();
    name.focus();
    await TerminalFocus.toggleAsync();
    expect(document.activeElement).toBe(first.element);
    name.remove();

    await TerminalFocus.toggleAsync();
    expect(document.activeElement).toBe(document.body);

    first.remove();
    expect(await TerminalFocus.toggleAsync()).toBe(true);
    expect(document.activeElement).toBe(second.element);
  });

  it("shows the terminal of the session and gives it the focus, and is false when no terminal of it is open or it can't show", async () => {
    const first: FakeTerminal = terminal("s1");
    const second: FakeTerminal = terminal("s2");
    const name: HTMLInputElement = field();
    name.focus();

    expect(await TerminalFocus.showAsync("s3")).toBe(false);
    expect(document.activeElement).toBe(name);
    expect(await TerminalFocus.showAsync("s2")).toBe(true);
    expect(document.activeElement).toBe(second.element);
    first.canShow = false;
    expect(await TerminalFocus.showAsync("s1")).toBe(false);
    expect(document.activeElement).toBe(second.element);
  });
});
