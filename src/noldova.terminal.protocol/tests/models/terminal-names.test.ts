/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalNames } from "../../src/models/terminal-names.ts";

describe("TerminalNames", () => {
  it("names each method on the wire, and lists them all in order", () => {
    assert.deepEqual([
      TerminalNames.shellsMethod, TerminalNames.openMethod, TerminalNames.closeMethod, TerminalNames.restartMethod, TerminalNames.sessionsMethod,
      TerminalNames.attachMethod, TerminalNames.inputMethod, TerminalNames.resizeMethod, TerminalNames.ackMethod, TerminalNames.visibilityMethod,
      TerminalNames.detachMethod, TerminalNames.linesMethod, TerminalNames.restoreMethod, TerminalNames.closeOwnerMethod, TerminalNames.launchMethod,
      TerminalNames.runMethod, TerminalNames.runOutputMethod, TerminalNames.windowStartedMethod, TerminalNames.showOwnerMethod,
      TerminalNames.renameMethod, TerminalNames.completeMethod, TerminalNames.findCommandsMethod
    ], TerminalNames.methods);
    assert.deepEqual(TerminalNames.methods, [
      "terminal.shells", "terminal.open", "terminal.close", "terminal.restart", "terminal.sessions", "terminal.attach", "terminal.input",
      "terminal.resize", "terminal.ack", "terminal.visibility", "terminal.detach", "terminal.lines", "terminal.restore", "terminal.closeOwner",
      "terminal.launch", "terminal.run", "terminal.runOutput", "terminal.windowStarted", "terminal.showOwner", "terminal.rename",
      "terminal.complete", "terminal.findCommands"
    ]);
  });

  it("names each event on the wire, and lists them all in order", () => {
    assert.deepEqual([
      TerminalNames.outputEvent, TerminalNames.exitedEvent, TerminalNames.restartedEvent, TerminalNames.titleChangedEvent,
      TerminalNames.cwdChangedEvent, TerminalNames.detachedEvent, TerminalNames.closedEvent, TerminalNames.openedEvent,
      TerminalNames.launchCommandEndedEvent, TerminalNames.runOpenedEvent, TerminalNames.runEndedEvent, TerminalNames.renamedEvent,
      TerminalNames.commandAddedEvent
    ], TerminalNames.events);
    assert.deepEqual(TerminalNames.events, [
      "terminal.output", "terminal.exited", "terminal.restarted", "terminal.titleChanged", "terminal.cwdChanged", "terminal.detached",
      "terminal.closed", "terminal.opened", "terminal.launchCommandEnded", "terminal.runOpened", "terminal.runEnded", "terminal.renamed",
      "terminal.commandAdded"
    ]);
  });

  it("gives every method and event its own name", () => {
    const names: readonly string[] = [...TerminalNames.methods, ...TerminalNames.events];

    assert.equal(new Set(names).size, names.length);
  });
});
