/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { EndedBy } from "../../src/enums/ended-by.ts";
import { TerminalExit } from "../../src/models/terminal-exit.ts";
import { TerminalExited } from "../../src/models/terminal-exited.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalExitedTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const json: object = { sessionId: "s1", exit: { exitCode: 130, endedBy: "Exit" } };

    Assert.areEqual(130, TerminalExited.fromJson(json).exit.exitCode);
    Expect.same(json, new TerminalExited("s1", new TerminalExit(130, EndedBy.Exit)).toJson());
  }

  @TestMethod
  public refusesAMissingExit(): void {
    Assert.throws(() => new TerminalExited(" ", new TerminalExit(0, EndedBy.Exit)), ArgumentException);
    Expect.throwsMatching(() => TerminalExited.fromJson({ sessionId: "s1" }), { name: "JsonException", path: "$.exit" });
  }
}
