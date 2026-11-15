/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
    assert.ok(output !== undefined && exited !== undefined && restarted !== undefined && titleChanged !== undefined && cwdChanged !== undefined
      && detached !== undefined && closed !== undefined && opened !== undefined && launchCommandEnded !== undefined && runOpened !== undefined
      && runEnded !== undefined && renamed !== undefined && commandAdded !== undefined);

    const events: TerminalEvents = new TerminalEvents(output, exited, restarted, titleChanged, cwdChanged, detached, closed, opened, launchCommandEnded,
      runOpened, runEnded, renamed, commandAdded);

    assert.deepEqual(
      [events.output, events.exited, events.restarted, events.titleChanged, events.cwdChanged, events.detached, events.closed, events.opened,
        events.launchCommandEnded, events.runOpened, events.runEnded, events.renamed, events.commandAdded], channels);
  });
});
