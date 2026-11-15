/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalSize } from "@noldova/terminal.protocol";
import { afterEach, describe, expect, it } from "vitest";

import type { ISizedPane } from "../../../src/app/interfaces/i-sized-pane.ts";
import { SessionSizing } from "../../../src/app/services/session-sizing.ts";

class SizedPane implements ISizedPane {
  public shown: boolean;
  public focused: boolean = false;
  public leads: number = 0;
  public readonly followed: string[] = [];

  public constructor(shown: boolean) {
    this.shown = shown;
  }

  public isShown(): boolean {
    return this.shown;
  }

  public hasFocus(): boolean {
    return this.focused;
  }

  public follow(size: TerminalSize): void {
    this.followed.push(`${size.columns}x${size.rows}`);
  }

  public lead(): void {
    this.leads++;
  }
}

describe("SessionSizing", () => {
  const joined: (() => void)[] = [];

  function join(sessionId: string, pane: SizedPane): () => void {
    const leave: () => void = SessionSizing.join(sessionId, pane);
    joined.push(leave);
    return leave;
  }

  afterEach(() => {
    for (const leave of joined.splice(0))
      leave();
  });

  it("lets a session's only pane size its shell, shown or hidden", () => {
    const pane: SizedPane = new SizedPane(false);

    const leave: () => void = join("only", pane);

    expect([SessionSizing.isSizing("only", pane), pane.leads]).toEqual([true, 1]);
    leave();
    expect(SessionSizing.isSizing("only", pane)).toBe(false);
  });

  it("lets the newest shown pane size the shell, and the other draw at its size", () => {
    const older: SizedPane = new SizedPane(true);
    const newer: SizedPane = new SizedPane(true);
    join("two", older);
    join("two", newer);

    SessionSizing.resized("two", newer, new TerminalSize(100, 30));
    SessionSizing.resized("two", older, new TerminalSize(60, 20));

    expect([SessionSizing.isSizing("two", older), SessionSizing.isSizing("two", newer)]).toEqual([false, true]);
    expect([older.followed, newer.followed]).toEqual([["100x30"], []]);
  });

  it("leaves the sizing with a pane the person is typing in when another opens, until that one is focused", () => {
    const typing: SizedPane = new SizedPane(true);
    typing.focused = true;
    const opened: SizedPane = new SizedPane(true);
    join("typing", typing);
    join("typing", opened);

    const first: boolean = SessionSizing.isSizing("typing", typing);
    SessionSizing.claim("typing", opened);

    expect([first, opened.leads, SessionSizing.isSizing("typing", opened)]).toEqual([true, 1, true]);
  });

  it("leaves the sizing with the pane the person focused last, once the focus left it, when another opens, until that one is focused", () => {
    const tab: SizedPane = new SizedPane(true);
    const older: SizedPane = new SizedPane(true);
    join("blurred", tab);
    join("blurred", older);
    SessionSizing.claim("blurred", tab);
    const opened: SizedPane = new SizedPane(true);

    join("blurred", opened);
    const first: boolean = SessionSizing.isSizing("blurred", tab);
    SessionSizing.claim("blurred", opened);

    expect([first, opened.leads, SessionSizing.isSizing("blurred", opened)]).toEqual([true, 1, true]);
  });

  it("forgets a pane's focus when it leaves, so a pane that opens after it joins again takes the sizing", () => {
    const tab: SizedPane = new SizedPane(true);
    const leaveTab: () => void = join("rejoin", tab);
    SessionSizing.claim("rejoin", tab);
    leaveTab();
    join("rejoin", tab);
    const opened: SizedPane = new SizedPane(true);

    join("rejoin", opened);

    expect([SessionSizing.isSizing("rejoin", opened), SessionSizing.isSizing("rejoin", tab)]).toEqual([true, false]);
  });

  it("keeps a shown pane sizing the shell over a newer hidden one", () => {
    const shown: SizedPane = new SizedPane(true);
    const hidden: SizedPane = new SizedPane(false);
    join("hidden", shown);
    join("hidden", hidden);

    expect([SessionSizing.isSizing("hidden", shown), hidden.leads]).toEqual([true, 0]);
  });

  it("gives the sizing to the pane the person focuses, and back to the other when it is focused", () => {
    const older: SizedPane = new SizedPane(true);
    const newer: SizedPane = new SizedPane(true);
    join("focus", older);
    join("focus", newer);

    SessionSizing.claim("focus", older);
    const first: boolean = SessionSizing.isSizing("focus", older);
    SessionSizing.claim("focus", newer);

    expect([first, SessionSizing.isSizing("focus", newer), older.leads, newer.leads]).toEqual([true, true, 2, 2]);
  });

  it("leaves the sizing where it is when the sizing pane is focused again", () => {
    const pane: SizedPane = new SizedPane(true);
    join("again", pane);

    SessionSizing.claim("again", pane);

    expect(pane.leads).toBe(1);
  });

  it("gives the sizing to another shown pane when the sizing pane hides, and back when it shows again", () => {
    const older: SizedPane = new SizedPane(true);
    const newer: SizedPane = new SizedPane(true);
    join("hides", older);
    join("hides", newer);

    newer.shown = false;
    SessionSizing.update("hides");
    const whileHidden: boolean = SessionSizing.isSizing("hides", older);
    newer.shown = true;
    SessionSizing.update("hides");

    expect([whileHidden, SessionSizing.isSizing("hides", newer)]).toEqual([true, true]);
  });

  it("gives the sizing to the other pane when the sizing pane goes", () => {
    const older: SizedPane = new SizedPane(true);
    const newer: SizedPane = new SizedPane(true);
    join("goes", older);
    const leaveNewer: () => void = join("goes", newer);

    leaveNewer();

    expect([SessionSizing.isSizing("goes", older), older.leads]).toEqual([true, 2]);
  });

  it("ignores a pane that leaves twice, and a focus for a session with no panes", () => {
    const pane: SizedPane = new SizedPane(true);
    const leave: () => void = join("twice", pane);

    leave();
    leave();
    SessionSizing.claim("twice", pane);

    expect([SessionSizing.isSizing("twice", pane), pane.leads]).toEqual([false, 1]);
  });

  it("ignores a focus from a pane that isn't the session's", () => {
    const pane: SizedPane = new SizedPane(true);
    const stranger: SizedPane = new SizedPane(true);
    join("stranger", pane);

    SessionSizing.claim("stranger", stranger);

    expect([SessionSizing.isSizing("stranger", pane), stranger.leads]).toEqual([true, 0]);
  });

  it("sizes each session apart", () => {
    const first: SizedPane = new SizedPane(true);
    const second: SizedPane = new SizedPane(true);
    join("apart-1", first);
    join("apart-2", second);

    SessionSizing.resized("apart-1", first, new TerminalSize(100, 30));

    expect([SessionSizing.isSizing("apart-1", first), SessionSizing.isSizing("apart-2", second), second.followed]).toEqual([true, true, []]);
  });
});
