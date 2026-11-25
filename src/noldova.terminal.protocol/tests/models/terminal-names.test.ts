/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TerminalNames } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalNamesTests {
  @TestMethod
  public namesEachMethodOnTheWireAndListsThemAllInOrder(): void {
    Expect.same(TerminalNames.methods, [
      TerminalNames.shellsMethod, TerminalNames.openMethod, TerminalNames.closeMethod, TerminalNames.restartMethod, TerminalNames.sessionsMethod,
      TerminalNames.attachMethod, TerminalNames.inputMethod, TerminalNames.resizeMethod, TerminalNames.ackMethod, TerminalNames.visibilityMethod,
      TerminalNames.detachMethod, TerminalNames.linesMethod, TerminalNames.restoreMethod, TerminalNames.closeOwnerMethod, TerminalNames.launchMethod,
      TerminalNames.runMethod, TerminalNames.runOutputMethod, TerminalNames.windowStartedMethod, TerminalNames.showOwnerMethod,
      TerminalNames.renameMethod, TerminalNames.completeMethod, TerminalNames.findCommandsMethod
    ]);
    Expect.same([
      "terminal.shells", "terminal.open", "terminal.close", "terminal.restart", "terminal.sessions", "terminal.attach", "terminal.input",
      "terminal.resize", "terminal.ack", "terminal.visibility", "terminal.detach", "terminal.lines", "terminal.restore", "terminal.closeOwner",
      "terminal.launch", "terminal.run", "terminal.runOutput", "terminal.windowStarted", "terminal.showOwner", "terminal.rename",
      "terminal.complete", "terminal.findCommands"
    ], TerminalNames.methods);
  }

  @TestMethod
  public namesEachEventOnTheWireAndListsThemAllInOrder(): void {
    Expect.same(TerminalNames.events, [
      TerminalNames.outputEvent, TerminalNames.exitedEvent, TerminalNames.restartedEvent, TerminalNames.titleChangedEvent,
      TerminalNames.cwdChangedEvent, TerminalNames.detachedEvent, TerminalNames.closedEvent, TerminalNames.openedEvent,
      TerminalNames.launchCommandEndedEvent, TerminalNames.runOpenedEvent, TerminalNames.runEndedEvent, TerminalNames.renamedEvent,
      TerminalNames.commandAddedEvent
    ]);
    Expect.same([
      "terminal.output", "terminal.exited", "terminal.restarted", "terminal.titleChanged", "terminal.cwdChanged", "terminal.detached",
      "terminal.closed", "terminal.opened", "terminal.launchCommandEnded", "terminal.runOpened", "terminal.runEnded", "terminal.renamed",
      "terminal.commandAdded"
    ], TerminalNames.events);
  }

  @TestMethod
  public givesEveryMethodAndEventItsOwnName(): void {
    const names: readonly string[] = [...TerminalNames.methods, ...TerminalNames.events];

    Assert.areEqual(names.length, new Set(names).size);
  }
}
