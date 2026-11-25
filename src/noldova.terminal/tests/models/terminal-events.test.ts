/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalEvents } from "../../src/models/terminal-events.ts";
import { FakeEventChannel } from "../fixtures/fake-runtime-part-context.fixture.ts";

describe("TerminalEvents", () => {
  it("holds one channel per event", () => {
    const channels: readonly FakeEventChannel[] = [
      new FakeEventChannel(), new FakeEventChannel(), new FakeEventChannel(), new FakeEventChannel(), new FakeEventChannel(), new FakeEventChannel(),
      new FakeEventChannel(), new FakeEventChannel(), new FakeEventChannel(), new FakeEventChannel(), new FakeEventChannel(), new FakeEventChannel(),
      new FakeEventChannel()];
    const [output, exited, restarted, titleChanged, cwdChanged, detached, closed, opened, launchCommandEnded, runOpened, runEnded, renamed, commandAdded] = channels;
    assert.ok(!Object.isUndefined(output) && !Object.isUndefined(exited) && !Object.isUndefined(restarted) && !Object.isUndefined(titleChanged) && !Object.isUndefined(cwdChanged)
      && !Object.isUndefined(detached) && !Object.isUndefined(closed) && !Object.isUndefined(opened) && !Object.isUndefined(launchCommandEnded) && !Object.isUndefined(runOpened)
      && !Object.isUndefined(runEnded) && !Object.isUndefined(renamed) && !Object.isUndefined(commandAdded));

    const events: TerminalEvents = new TerminalEvents(output, exited, restarted, titleChanged, cwdChanged, detached, closed, opened, launchCommandEnded,
      runOpened, runEnded, renamed, commandAdded);

    assert.deepEqual(
      [events.output, events.exited, events.restarted, events.titleChanged, events.cwdChanged, events.detached, events.closed, events.opened,
        events.launchCommandEnded, events.runOpened, events.runEnded, events.renamed, events.commandAdded], channels);
  });
});
