/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalCwd } from "../../src/models/terminal-cwd.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalCwdTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    Assert.areEqual("/home/me/src", TerminalCwd.fromJson({ sessionId: "s1", cwd: "/home/me/src" }).cwd);
    Expect.same({ sessionId: "s1", cwd: "C:\\src" }, new TerminalCwd("s1", "C:\\src").toJson());
  }

  @TestMethod
  public refusesABlankFolderOrOneLongerThan4096Characters(): void {
    Assert.throws(() => new TerminalCwd("s1", " "), ArgumentException);
    Assert.throws(() => new TerminalCwd("s1", "/".repeat(4097)), ArgumentException);
    Expect.throwsMatching(() => TerminalCwd.fromJson({ sessionId: "s1", cwd: "" }), { name: "JsonException", path: "$.cwd" });
  }

  @TestMethod
  public refusesABlankSession(): void {
    for (const id of ["", " "])
      Expect.throwsMatching(() => new TerminalCwd(id, "/work"), { name: "ArgumentException", parameterName: "sessionId" });
  }
}
