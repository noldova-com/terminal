/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { RequestClient } from "../../src/models/request-client.ts";
import { TerminalAudience } from "../../src/services/terminal-audience.ts";
import { FakeEventChannel } from "../fixtures/fake-runtime-part-context.fixture.ts";

const TERMINAL: { isReachedBy(connection: number, isApp: boolean): boolean } = { isReachedBy: (connection, isApp) => isApp || connection === 2 };

function createOwned(owner: string | null): { isReachedBy(connection: number, isApp: boolean): boolean; owner: string | null } {
  return { isReachedBy: connection => connection === 1, owner };
}

describe("TerminalAudience", () => {
  it("publishes to each window of each connection that reaches the terminal, and to a connection without windows itself", () => {
    const audience: TerminalAudience = new TerminalAudience();
    const channel: FakeEventChannel = new FakeEventChannel();
    for (const client of [new RequestClient(1, 1, true), new RequestClient(1, 2, true), new RequestClient(1, 1, true), new RequestClient(2, null, false),
      new RequestClient(3, 1, false)])
      audience.see(client);

    audience.publish(channel, TERMINAL, { sessionId: "s1" });

    assert.deepEqual(channel.targets, ["1/1", "1/2", "2/null"]);
  });

  it("forgets a window closed for good and a closed connection, and tells which was the app's", () => {
    const audience: TerminalAudience = new TerminalAudience();
    const channel: FakeEventChannel = new FakeEventChannel();
    audience.see(new RequestClient(1, 1, true));
    audience.see(new RequestClient(1, 2, true));
    audience.see(new RequestClient(2, null, false));

    const forgotten: boolean[] = [audience.forget(1, 2), audience.forget(9, 1), audience.forget(2, null), audience.forget(9, null)];
    audience.publish(channel, TERMINAL, null);
    const app: boolean = audience.forget(1, null);
    audience.publish(channel, TERMINAL, null);

    assert.deepEqual([forgotten, app], [[false, false, false, false], true]);
    assert.deepEqual(channel.targets, ["1/1"]);
  });

  it("tells whether a window that reaches a terminal shows its owner, keeping each window's last owner", () => {
    const audience: TerminalAudience = new TerminalAudience();
    audience.show(new RequestClient(1, 1, true), "chat/1", false);
    audience.show(new RequestClient(1, 2, true), "chat/2", false);
    audience.show(new RequestClient(2, 1, false), "chat/3", false);
    audience.show(new RequestClient(1, null, true), "chat/4", false);

    const shown: boolean[] = ["chat/1", "chat/2", "chat/3", "chat/4"].map(t => audience.shows(createOwned(t)));
    audience.show(new RequestClient(1, 1, true), "chat/2", false);
    audience.show(new RequestClient(1, 2, true), null, false);

    assert.deepEqual([shown, audience.shows(createOwned("chat/1")), audience.shows(createOwned("chat/2")), audience.shows(createOwned(null))],
      [[true, true, false, false], false, true, false]);
  });

  it("drops a window's owner when the window or its connection closes", () => {
    const audience: TerminalAudience = new TerminalAudience();
    audience.show(new RequestClient(1, 1, true), "chat/1", false);
    audience.show(new RequestClient(1, 2, true), "chat/2", false);

    audience.forget(1, 1);
    const afterWindow: boolean[] = [audience.shows(createOwned("chat/1")), audience.shows(createOwned("chat/2"))];
    audience.forget(1, null);

    assert.deepEqual([afterWindow, audience.shows(createOwned("chat/2"))], [[false, true], false]);
  });

  it("tells whether a window is hidden, as it last said, until the window or its connection closes, and never a connection without windows", () => {
    const audience: TerminalAudience = new TerminalAudience();
    audience.show(new RequestClient(1, 1, true), null, true);
    audience.show(new RequestClient(1, 2, true), "chat/2", true);
    audience.show(new RequestClient(2, 1, false), null, true);
    audience.show(new RequestClient(3, null, false), null, true);

    const hidden: boolean[] = [new RequestClient(1, 1, true), new RequestClient(1, 2, true), new RequestClient(2, 1, false), new RequestClient(3, null, false),
      new RequestClient(4, 1, false)].map(t => audience.isHidden(t));
    audience.show(new RequestClient(1, 2, true), "chat/2", false);
    audience.forget(1, 1);
    audience.forget(2, null);

    assert.deepEqual([hidden, [new RequestClient(1, 1, true), new RequestClient(1, 2, true), new RequestClient(2, 1, false)].map(t => audience.isHidden(t))],
      [[true, true, true, false, false], [false, false, false]]);
  });

  it("tells whether a window or a connection without windows is still open", () => {
    const audience: TerminalAudience = new TerminalAudience();
    audience.see(new RequestClient(1, 1, true));
    audience.see(new RequestClient(2, null, false));

    const open: boolean[] = [new RequestClient(1, 1, true), new RequestClient(1, 2, true), new RequestClient(2, null, false), new RequestClient(3, null, false)]
      .map(t => audience.isOpen(t));
    audience.forget(1, 1);

    assert.deepEqual([open, audience.isOpen(new RequestClient(1, 1, true))], [[true, false, true, false], false]);
  });
});
