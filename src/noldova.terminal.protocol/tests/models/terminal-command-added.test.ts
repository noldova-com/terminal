/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalCommandAdded } from "../../src/models/terminal-command-added.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalCommandAddedTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const json: object = { sessionId: "s1", command: "git commit -m \"x\"" };

    Assert.areEqual("git commit -m \"x\"", TerminalCommandAdded.fromJson(json).command);
    Expect.same(json, new TerminalCommandAdded("s1", "git commit -m \"x\"").toJson());
  }

  @TestMethod
  public refusesABlankOrTooLongCommand(): void {
    Assert.areEqual(4_096, new TerminalCommandAdded("s1", "c".repeat(4_096)).command.length);
    Assert.throws(() => new TerminalCommandAdded("s1", " "), ArgumentException);
    Assert.throws(() => new TerminalCommandAdded("s1", "c".repeat(4_097)), ArgumentException);
    Expect.throwsMatching(() => TerminalCommandAdded.fromJson({ sessionId: "s1", command: "" }), { name: "JsonException", path: "$.command" });
    Expect.throwsMatching(() => TerminalCommandAdded.fromJson({ sessionId: "s1", command: "ls", cwd: "/" }), { name: "JsonException", path: "$.cwd" });
  }

  @TestMethod
  public refusesABlankSession(): void {
    for (const id of ["", " "])
      Expect.throwsMatching(() => new TerminalCommandAdded(id, "ls"), { name: "ArgumentException", parameterName: "sessionId" });
  }
}
